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
  write: (patch: P) => Promise<void>;
  debounceMs?: number;
};

type KeyState<P> = {
  key: SaveKey;
  label?: string;
  patch?: P;
  write?: (patch: P) => Promise<void>;
  merge?: (prev: P, next: P) => P;
  debounceMs: number;

  timer: any;
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

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit() {
    for (const cb of this.listeners) cb();
  }

  getSnapshot(): SaveQueueSnapshot {
    const keys: SaveKeyStatus[] = [];
    let pendingCount = 0;
    let inFlightCount = 0;
    let errorCount = 0;

    for (const st of this.states.values()) {
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
    }

    keys.sort((a, b) => b.updatedAt - a.updatedAt);
    return { pendingCount, inFlightCount, errorCount, keys };
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

  /** Enqueue a patch for a key; multiple patches for same key are merged. */
  enqueue<P>(req: EnqueueRequest<P>): Promise<void> {
    const now = Date.now();

    let st = this.states.get(req.key) as KeyState<P> | undefined;
    if (!st) {
      st = {
        key: req.key,
        label: req.label,
        patch: req.patch,
        write: req.write,
        merge: req.merge,
        debounceMs: req.debounceMs ?? 500,
        timer: null,
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
      st.updatedAt = now;
    }

    // new change clears error
    st.lastError = null;

    const waiter = defer<void>();
    st.waiters.add(waiter);

    this.schedule(req.key, st);
    this.emit();

    return waiter.promise;
  }

  private schedule(key: SaveKey, st: KeyState<any>) {
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => {
      st.timer = null;
      void this.flushKey(key);
    }, st.debounceMs);
  }

  /** Force-send a single key now. */
  async flushKey(key: SaveKey): Promise<void> {
    const st = this.states.get(key);
    if (!st) return;

    if (st.inFlight) {
      try { await st.inFlight; } catch { /* ignore */ }
    }

    if (st.patch === undefined) {
      this.resolveIfIdle(st);
      this.emit();
      return;
    }

    const patch = st.patch;
    st.patch = undefined;

    const write = st.write;
    if (!write) {
      st.lastError = new Error('SaveQueue missing writer');
      st.patch = patch;
      this.emit();
      return;
    }

    const run = async () => { await write(patch); };

    const p = run()
      .then(() => { st.lastError = null; })
      .catch((e) => {
        st.lastError = e;
        // Put patch back so it can be retried later (no data loss in-session)
        st.patch = st.patch === undefined ? patch : st.merge ? st.merge(st.patch, patch) : st.patch;
      })
      .finally(async () => {
        st.inFlight = null;
        if (st.patch !== undefined) {
          await this.flushKey(key);
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

  /** Flush everything. Times out (default 8s) and does not block forever on persistent failures. */
  async flushAll(opts: { timeoutMs?: number } = {}): Promise<{ ok: boolean }> {
    const timeoutMs = opts.timeoutMs ?? 8000;
    const keys = Array.from(this.states.keys());

    for (const key of keys) {
      const st = this.states.get(key);
      if (st?.timer) {
        clearTimeout(st.timer);
        st.timer = null;
      }
    }

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
    const ok = !timedOut && snap.pendingCount === 0 && snap.inFlightCount === 0 && snap.errorCount === 0;
    return { ok };
  }

  retryKey(key: SaveKey) {
    const st = this.states.get(key);
    if (!st) return;
    if (st.timer) clearTimeout(st.timer);
    st.timer = null;
    void this.flushKey(key);
  }

  private resolveIfIdle(st: KeyState<any>) {
    const idle = st.patch === undefined && !st.inFlight;
    if (!idle) return;
    if (st.waiters.size === 0) return;
    for (const w of st.waiters) w.resolve();
    st.waiters.clear();
  }
}
