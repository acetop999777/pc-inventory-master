import re
from pathlib import Path

ROOT = Path("client/src")

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")

# 1) 找到 SyncStatus/顶部条组件（优先包含 NEEDS SYNC）
cands = []
for p in ROOT.rglob("*.tsx"):
    t = read(p)
    if "NEEDS SYNC" in t and "Retry" in t:
        cands.append((p, t))

if not cands:
    # fallback：只找 Retry
    for p in ROOT.rglob("*.tsx"):
        t = read(p)
        if "Retry" in t and ".flushAll" in t:
            cands.append((p, t))

if not cands:
    raise SystemExit("ERROR: cannot find SyncStatus component file (no 'NEEDS SYNC'+'Retry' or 'Retry'+'.flushAll').")

def score(p: Path, t: str) -> int:
    name = p.name.lower()
    s = 0
    if "syncstatus" in name: s += 100
    if "sync" in name: s += 50
    if "status" in name: s += 30
    if "needs sync" in t.lower(): s += 20
    if "flushall" in t.lower(): s += 20
    if "retry" in t.lower(): s += 10
    return s

cands.sort(key=lambda x: score(x[0], x[1]), reverse=True)
target, text = cands[0]
print("✅ SyncStatus candidate:", target)

if "Phase7.5: Retry invalidates queries" in text:
    print("ℹ️ Phase7.5 already applied; skipping.")
    raise SystemExit(0)

lines = text.splitlines()

# 2) 确保 useQueryClient import 存在
def ensure_useQueryClient_import(lines):
    for i, ln in enumerate(lines):
        if "@tanstack/react-query" in ln:
            if "useQueryClient" in ln:
                return lines
            m = re.match(r"^\s*import\s*\{([^}]+)\}\s*from\s*'@tanstack/react-query';\s*$", ln)
            if m:
                names = [x.strip() for x in m.group(1).split(",") if x.strip()]
                names.append("useQueryClient")
                names = sorted(set(names))
                lines[i] = f"import {{ {', '.join(names)} }} from '@tanstack/react-query';"
                return lines
    # 没有 react-query import：插入到 import 区块末尾
    insert_at = 0
    for i, ln in enumerate(lines):
        if ln.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, "import { useQueryClient } from '@tanstack/react-query';")
    return lines

lines = ensure_useQueryClient_import(lines)

# 3) 插入 queryClient 变量（在组件 body 内尽量靠前）
joined = "\n".join(lines)
if "useQueryClient()" not in joined:
    insert_i = None
    # function Comp() { ... }  或  const Comp = (...) => { ... }
    for i, ln in enumerate(lines):
        if ("function " in ln or re.search(r"\bconst\s+\w+\s*=", ln)) and "{" in ln:
            insert_i = i + 1
            break
    if insert_i is None:
        for i, ln in enumerate(lines):
            if ln.strip() == "{":
                insert_i = i + 1
                break
    if insert_i is None:
        raise SystemExit("ERROR: cannot find component body to insert queryClient.")

    indent = "  "
    if insert_i < len(lines):
        m = re.match(r"^(\s*)", lines[insert_i])
        if m and m.group(1) is not None:
            indent = m.group(1) or indent

    lines.insert(insert_i, f"{indent}const queryClient = useQueryClient();")
    lines.insert(insert_i+1, f"{indent}// Phase7.5: Retry invalidates queries after successful flush (keeps UI consistent).")

# 4) 找 flushAll 的对象名（例如 saveQueue.flushAll()）
flush_obj = None
m = re.search(r"([A-Za-z_]\w*)\.flushAll\s*\(\s*\)", text)
if m:
    flush_obj = m.group(1)

# 5) 生成 onRetry，并替换按钮 onClick
out = []
added_onRetry = False

# 简单策略：
# - 如果出现 JSX: onClick={() => X.flushAll()} 这种，替换成 onClick={onRetry}
# - 如果出现 await X.flushAll()，在后面插入 await invalidateQueries()
onClick_pat = re.compile(r"onClick=\{\(\)\s*=>\s*([A-Za-z_]\w*)\.flushAll\s*\(\s*\)\s*\}")
await_pat = re.compile(r"^\s*await\s+([A-Za-z_]\w*)\.flushAll\s*\(\s*\)\s*;?\s*$")

for ln in lines:
    # 替换 onClick
    m1 = onClick_pat.search(ln)
    if m1:
        flush_obj = flush_obj or m1.group(1)
        ln = onClick_pat.sub("onClick={onRetry}", ln)
        out.append(ln)
        continue

    # await flushAll 后插入 invalidate
    m2 = await_pat.match(ln.strip())
    if m2 and "invalidateQueries" not in "\n".join(lines):
        out.append(ln)
        indent = re.match(r"^(\s*)", ln).group(1)
        out.append(f"{indent}await queryClient.invalidateQueries();")
        continue

    out.append(ln)

# 如果没替换到 onClick（可能写法不同），就把所有 ".flushAll()" 改成 ".flushAll().then(() => queryClient.invalidateQueries())"
txt2 = "\n".join(out)
if "onRetry" not in txt2 and ".flushAll()" in txt2 and "invalidateQueries" not in txt2:
    txt2 = re.sub(r"(\.flushAll\s*\(\s*\))", r"\1.then(() => queryClient.invalidateQueries())", txt2, count=1)
    out = txt2.splitlines()

# 插入 onRetry（如果 onClick 已换成 onRetry）
txt3 = "\n".join(out)
if "onClick={onRetry}" in txt3 and "const onRetry" not in txt3:
    if not flush_obj:
        raise SystemExit("ERROR: cannot infer flushAll object name. Please search for '.flushAll()' usage in SyncStatus file.")
    # 插在 queryClient 之后
    idx = None
    for i, ln in enumerate(out):
        if "const queryClient = useQueryClient();" in ln:
            idx = i + 2
            break
    if idx is None:
        idx = 0
    indent = re.match(r"^(\s*)", out[idx] if idx < len(out) else "").group(1) if idx is not None else "  "
    block = [
        f"{indent}const onRetry = async () => {{",
        f"{indent}  await {flush_obj}.flushAll();",
        f"{indent}  await queryClient.invalidateQueries();",
        f"{indent}}};",
    ]
    out[idx:idx] = block
    added_onRetry = True

Path(target).write_text("\n".join(out) + "\n", encoding="utf-8")
print("✅ patched:", target)
