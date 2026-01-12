set -euo pipefail
cd ~/pc-inventory-master

mkdir -p ops/patches

cat > ops/patches/phase4_0_savequeue_no_autoretry_on_error.diff <<'PATCH'
diff --git a/client/src/app/saveQueue/SaveQueue.ts b/client/src/app/saveQueue/SaveQueue.ts
--- a/client/src/app/saveQueue/SaveQueue.ts
+++ b/client/src/app/saveQueue/SaveQueue.ts
@@ -234,9 +234,16 @@
       .finally(async () => {
         st.inFlight = null;
         if (st.patch !== undefined) {
-          await this.flushKey(key);
-          return;
+          // If new patch arrived while we were in-flight:
+          // - If the last attempt succeeded, flush again immediately.
+          // - If the last attempt failed, DO NOT auto-retry (avoid retry storms).
+          if (st.lastError == null) {
+            await this.flushKey(key);
+            return;
+          }
+          this.emit();
+          return;
         }
         this.resolveIfIdle(st);
         this.emit();
       });
PATCH

git apply ops/patches/phase4_0_savequeue_no_autoretry_on_error.diff
git add -A
git commit -m "savequeue: stop auto-retry loop on write error"
git tag -a "phase4_0_savequeue_no_autoretry_on_error" -m "SaveQueue: no retry storm on error"

./scripts/smoke.sh
