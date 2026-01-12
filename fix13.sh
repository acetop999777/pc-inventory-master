set -euo pipefail
cd ~/pc-inventory-master 2>/dev/null || cd "$PWD"

mkdir -p ops/patches

cat > ops/patches/phase1_clients_save_throw.diff <<'PATCH'
diff --git a/client/src/AppLegacy.tsx b/client/src/AppLegacy.tsx
index 37b1e3e..b07de4b 100644
--- a/client/src/AppLegacy.tsx
+++ b/client/src/AppLegacy.tsx
@@ -2,7 +2,7 @@ import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
 import { ClientEntity } from './domain/client/client.types';
 import { calculateFinancials, createEmptyClient } from './domain/client/client.logic';
 import { InventoryItem } from './types';
-import { apiCall, generateId } from './utils';
+import { apiCall, apiCallOrThrow, generateId } from './utils';
 
 import { MainLayout } from './presentation/layouts/MainLayout';
 import Dashboard from './presentation/modules/Dashboard/Dashboard';
@@ -90,14 +90,14 @@ export default function AppLegacy() {
     setShowSaved(false);
   };
 
-  const handleSave = useCallback(async () => {
-    if (!activeClient) return;
-    if (!dirty) return;
+  const handleSave = useCallback(async (): Promise<boolean> => {
+    if (!activeClient) return true;
+    if (!dirty) return true;
 
     setSaving(true);
     try {
       const fin = calculateFinancials(activeClient);
-      await apiCall('/clients', 'POST', {
+      await apiCallOrThrow('/clients', 'POST', {
         ...activeClient,
         actualCost: fin.totalCost,
         profit: fin.profit,
@@ -105,9 +105,11 @@ export default function AppLegacy() {
       setDirty(false);
       markSaved();
       void refreshData();
+      return true;
     } catch (e) {
       console.error('Save failed', e);
       // 失败时保留 dirty，让下一次还能继续尝试
+      return false;
     } finally {
       setSaving(false);
     }
@@ -133,7 +135,11 @@ export default function AppLegacy() {
 
   const flushAndGo = useCallback(async (next: () => void) => {
     if (mainView === 'clients' && subView === 'detail' && dirty) {
-      try { await handleSave(); } catch {}
+      const ok = await handleSave();
+      if (!ok) {
+        const leave = window.confirm('Save failed. Leave this page and discard local changes?');
+        if (!leave) return;
+      }
     }
     next();
   }, [dirty, handleSave, mainView, subView]);
PATCH

git apply ops/patches/phase1_clients_save_throw.diff
git add -A
git commit -m "clients: use apiCallOrThrow for save + confirm on leave when save fails"
git tag -a "phase1_clients_save_throw" -m "Clients save must not silently succeed on API failure"

./scripts/smoke.sh
