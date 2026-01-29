export type SaveKey = string;

export type SaveKeyStatus = {
  key: SaveKey;
  label?: string;
  pending: boolean;
  inFlight: boolean;
  hasError: boolean;
  lastError?: unknown;
  updatedAt: number;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};

function defer<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export type EnqueueRequest<P> = {
  key: SaveKey;
  label?: string;
  patch: P;
  merge: (prev: P, next: P) => P;
  write: (patch: P, ctx: { operationId: string }) => Promise<void>;
  debounceMs?: number;
};

type KeyState<P> = {
  key: SaveKey;
  label?: string;
  patch?: P;
  pendingOperationId?: string | null;
  inFlightOperationId?: string | null;
  write?: (patch: P, ctx: { operationId: string }) => Promise<void>;
  merge?: (prev: P, next: P) => P;
  debounceMs: number;

  timer: any;
  retryTimer: any;
  retryCount: number;
  inFlight: Promise<void> | null;
  lastError: unknown;
  updatedAt: number;

  waiters: Set<Deferred<void>>;
};

export type SaveQueueSnapshot = {
  pendingCount: number;
  inFlightCount: number;
  errorCount: number;
  keys: SaveKeyStatus[];
};

export class SaveQueue {
  private states = new Map<SaveKey, KeyState<any>>();
  private listeners = new Set<() => void>();

  // IMPORTANT for useSyncExternalStore:
  // getSnapshot MUST be referentially stable when store hasn't changed.
  private snapshotDirty = true;
  private cachedSnapshot: SaveQueueSnapshot = {
    pendingCount: 0,
    inFlightCount: 0,
    errorCount: 0,
    keys: [],
  };

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private markDirty() {
    this.snapshotDirty = true;
  }

  private emit() {
    // Mark snapshot dirty BEFORE notifying subscribers
    // so next render sees a new stable snapshot.
    this.markDirty();

    // Avoid for..of over Set (TS target ES5)
    this.listeners.forEach((cb) => cb());
  }

  private isRetryableError(err: any): boolean {
    if (typeof err?.retryable === 'boolean') return err.retryable;
    if (typeof err?.retriable === 'boolean') return err.retriable;
    const status = err?.status ?? err?.httpStatus;
    if (typeof status === 'number') return status >= 500 || status === 429 || status === 408;
    return true;
  }

  private makeOperationId(): string {
    const cryptoObj: any = (globalThis as any).crypto;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `op_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private computeSnapshot(): SaveQueueSnapshot {
    const keys: SaveKeyStatus[] = [];
    let pendingCount = 0;
    let inFlightCount = 0;
    let errorCount = 0;

    // Avoid for..of over Map iterators
    this.states.forEach((st) => {
      const pending = st.patch !== undefined;
      const inFlight = !!st.inFlight;
      const hasError = st.lastError != null;

      if (pending) pendingCount++;
      if (inFlight) inFlightCount++;
      if (hasError) errorCount++;

      keys.push({
        key: st.key,
        label: st.label,
        pending,
        inFlight,
        hasError,
        lastError: st.lastError,
        updatedAt: st.updatedAt,
      });
    });

    keys.sort((a, b) => b.updatedAt - a.updatedAt);
    return { pendingCount, inFlightCount, errorCount, keys };
  }

  getSnapshot(): SaveQueueSnapshot {
    if (this.snapshotDirty) {
      this.cachedSnapshot = this.computeSnapshot();
      this.snapshotDirty = false;
    }
    return this.cachedSnapshot;
  }

  getKeyStatus(key: SaveKey): SaveKeyStatus {
    const st = this.states.get(key);
    if (!st) return { key, pending: false, inFlight: false, hasError: false, updatedAt: 0 };
    return {
      key,
      label: st.label,
      pending: st.patch !== undefined,
      inFlight: !!st.inFlight,
      hasError: st.lastError != null,
      lastError: st.lastError,
      updatedAt: st.updatedAt,
    };
  }

  enqueue<P>(req: EnqueueRequest<P>): Promise<void> {
    const now = Date.now();

    let st = this.states.get(req.key) as KeyState<P> | undefined;
    if (!st) {
      st = {
        key: req.key,
        label: req.label,
        patch: req.patch,
        pendingOperationId: null,
        inFlightOperationId: null,
        write: req.write,
        merge: req.merge,
        debounceMs: req.debounceMs ?? 500,
        timer: null,
        retryTimer: null,
        retryCount: 0,
        inFlight: null,
        lastError: null,
        updatedAt: now,
        waiters: new Set(),
      };
      this.states.set(req.key, st);
    } else {
      st.label = req.label ?? st.label;
      st.write = req.write;
      st.merge = req.merge;
      st.debounceMs = req.debounceMs ?? st.debounceMs;
      st.patch = st.patch === undefined ? req.patch : st.merge!(st.patch, req.patch);
      st.pendingOperationId = null;
      st.updatedAt = now;
    }

    // Phase7.3: keep lastError sticky while user continues editing; Retry will attempt flush.

    const waiter = defer<void>();
    st.waiters.add(waiter);

    this.schedule(req.key, st);
    this.emit();

    return waiter.promise;
  }

  private schedule(key: SaveKey, st: KeyState<any>) {
    // Hold patches while non-retryable error (user must fix inputs / retry).
    if (st.lastError != null && !this.isRetryableError(st.lastError)) {
      this.emit();
      return;
    }
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => {
      st.timer = null;
      void this.flushKey(key);
    }, st.debounceMs);
  }

  async flushKey(key: SaveKey): Promise<void> {
    const st = this.states.get(key);
    if (!st) return;

    if (st.inFlight) {
      try {
        await st.inFlight;
      } catch {
        /* ignore */
      }
    }

    if (st.retryTimer) {
      clearTimeout(st.retryTimer);
      st.retryTimer = null;
    }

    if (st.patch === undefined) {
      this.resolveIfIdle(st);
      this.emit();
      return;
    }

    const patch = st.patch;
    const operationId = st.pendingOperationId || this.makeOperationId();
    st.patch = undefined;
    st.pendingOperationId = null;
    st.inFlightOperationId = operationId;

    const write = st.write;
    if (!write) {
      st.lastError = new Error('SaveQueue missing writer');
      st.patch = patch;
      this.emit();
      return;
    }

    const run = async () => {
      await write(patch, { operationId });
    };

    const p = run()
      .then(() => {
        st.lastError = null;
        st.retryCount = 0;
        st.inFlightOperationId = null;
      })
      .catch((e) => {
        st.lastError = e;
        const hadPending = st.patch !== undefined;
        if (hadPending) {
          st.patch = st.merge ? st.merge(st.patch, patch) : st.patch;
          st.pendingOperationId = null;
        } else {
          st.patch = patch;
          st.pendingOperationId = st.inFlightOperationId || null;
        }
        st.inFlightOperationId = null;

        if (this.isRetryableError(e)) {
          const delay = Math.min(1000 * 2 ** st.retryCount, 15000);
          st.retryCount += 1;
          if (st.retryTimer) clearTimeout(st.retryTimer);
          st.retryTimer = setTimeout(() => {
            st.retryTimer = null;
            void this.flushKey(key);
          }, delay);
        }
      })
      .finally(async () => {
        st.inFlight = null;
        if (st.patch !== undefined) {
          // If new patch arrived while we were in-flight:
          // - If the last attempt succeeded, flush again immediately.
          // - If the last attempt failed, DO NOT auto-retry (avoid retry storms).
          if (st.lastError == null) {
            await this.flushKey(key);
            return;
          }
          this.emit();
          return;
        }
        this.resolveIfIdle(st);
        this.emit();
      });

    st.inFlight = p;
    st.updatedAt = Date.now();
    this.emit();

    await p;
  }

  async flushAll(opts: { timeoutMs?: number } = {}): Promise<{ ok: boolean }> {
    const timeoutMs = opts.timeoutMs ?? 8000;

    const keys: SaveKey[] = [];
    this.states.forEach((_st, key) => keys.push(key));

    this.states.forEach((st) => {
      if (st.timer) {
        clearTimeout(st.timer);
        st.timer = null;
      }
    });

    const work = Promise.allSettled(keys.map((k) => this.flushKey(k)));

    let timedOut = false;
    const timer = new Promise<void>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    });

    await Promise.race([work.then(() => undefined), timer]);

    const snap = this.getSnapshot();
    const ok =
      !timedOut && snap.pendingCount === 0 && snap.inFlightCount === 0 && snap.errorCount === 0;
    return { ok };
  }

  retryKey(key: SaveKey) {
    const st = this.states.get(key);
    if (!st) return;
    if (st.timer) clearTimeout(st.timer);
    st.timer = null;
    if (st.retryTimer) clearTimeout(st.retryTimer);
    st.retryTimer = null;
    void this.flushKey(key);
  }

  dismissKey(key: SaveKey) {
    const st = this.states.get(key);
    if (!st) return;
    if (st.timer) clearTimeout(st.timer);
    st.timer = null;
    if (st.retryTimer) clearTimeout(st.retryTimer);
    st.retryTimer = null;
    st.patch = undefined;
    st.lastError = null;
    st.pendingOperationId = null;
    st.inFlightOperationId = null;
    if (!st.inFlight) {
      st.waiters.forEach((w) => w.resolve());
      st.waiters.clear();
      this.states.delete(key);
    }
    this.emit();
  }

  private resolveIfIdle(st: KeyState<any>) {
    const idle = st.patch === undefined && !st.inFlight;
    if (!idle) return;
    if (st.waiters.size === 0) return;

    st.waiters.forEach((w) => w.resolve());
    st.waiters.clear();
  }
}
