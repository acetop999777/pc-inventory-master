cd ~/pc-inventory-master || exit 1
set -euo pipefail

echo "==[PATCH 2/2] Optimistic Inventory Save/Delete =="
mkdir -p _backup_stage2
cp -a client/src/presentation/modules/Inventory/InventoryHub.tsx "_backup_stage2/InventoryHub.tsx.$(date +%Y%m%d_%H%M%S).bak"

python3 - <<'PY'
from pathlib import Path, re
p = Path("client/src/presentation/modules/Inventory/InventoryHub.tsx")
txt = p.read_text(encoding="utf-8")

# Remove existing refresh() calls
txt = re.sub(r'\brefresh\(\);?', '', txt)

# Patch optimistic save & delete logic
patch = '''
  // --- Optimistic save ---
  const handleFieldChange = async (itemId: string, field: string, value: any) => {
    setInventory(prev =>
      prev.map(it => it.id === itemId ? { ...it, [field]: value } : it)
    );
    try {
      await apiCall(`/inventory/${itemId}`, 'PUT', { [field]: value });
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  // --- Optimistic delete ---
  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Delete this item?')) return;
    const prev = inventory;
    setInventory(prev => prev.filter(it => it.id !== itemId));
    try {
      await apiCall(`/inventory/${itemId}`, 'DELETE');
    } catch (err) {
      alert('Delete failed');
      setInventory(prev); // rollback
    }
  };
'''

# Replace old handlers if present
txt = re.sub(r'async function.*?\{[\s\S]+?\}', '', txt, count=0)
txt = txt.replace('export default function InventoryHub(', patch + '\nexport default function InventoryHub(')

p.write_text(txt, encoding="utf-8")
print("Patched:", p)
PY

echo "== rebuild client =="
docker compose build client
