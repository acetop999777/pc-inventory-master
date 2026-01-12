import re
from pathlib import Path

ROOT = Path("client/src")

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")

# 1) Find best candidate file for SyncStatus
candidates = []
for p in ROOT.rglob("*.ts*"):
    if p.suffix not in [".ts", ".tsx"]:
        continue
    t = read(p)
    if "NEEDS SYNC" in t:
        candidates.append((p, t))

if not candidates:
    # fallback: Retry + flushAll
    for p in ROOT.rglob("*.ts*"):
        if p.suffix not in [".ts", ".tsx"]:
            continue
        t = read(p)
        if "flushAll" in t and "Retry" in t:
            candidates.append((p, t))

if not candidates:
    raise SystemExit("ERROR: cannot find SyncStatus file (no 'NEEDS SYNC' or 'Retry'+'flushAll' found).")

def score(p: Path, t: str) -> int:
    name = p.name.lower()
    s = 0
    if "syncstatus" in name: s += 100
    if "sync" in name: s += 50
    if "status" in name: s += 30
    if "flushall" in t: s += 20
    if "needs sync" in t.lower(): s += 20
    if "retry" in t.lower(): s += 10
    return s

candidates.sort(key=lambda x: score(x[0], x[1]), reverse=True)
target, text = candidates[0]

# sanity: avoid patching wrong file if top two are tied
if len(candidates) > 1 and score(candidates[0][0], candidates[0][1]) == score(candidates[1][0], candidates[1][1]):
    raise SystemExit("ERROR: multiple equally-likely SyncStatus candidates. Please narrow manually with: rg -n \"NEEDS SYNC\" client/src")

print("✅ SyncStatus candidate:", target)

if "Phase7.5: Retry invalidates queries" in text:
    print("ℹ️ already patched; skipping.")
    raise SystemExit(0)

lines = text.splitlines()

# 2) Ensure import useQueryClient
has_react_query_import = any("@tanstack/react-query" in ln for ln in lines)
if not has_react_query_import:
    # insert after last import
    insert_at = 0
    for i, ln in enumerate(lines):
        if ln.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, "import { useQueryClient } from '@tanstack/react-query';")
else:
    # add to existing named import if possible
    for i, ln in enumerate(lines):
        if "@tanstack/react-query" in ln and "useQueryClient" not in ln:
            m = re.match(r"^import\s+\{([^}]+)\}\s+from\s+'@tanstack/react-query';\s*$", ln.strip())
            if m:
                names = [x.strip() for x in m.group(1).split(",") if x.strip()]
                names.append("useQueryClient")
                names = sorted(set(names))
                lines[i] = f"import {{ {', '.join(names)} }} from '@tanstack/react-query';"
            else:
                # fallback: add another import
                insert_at = i + 1
                lines.insert(insert_at, "import { useQueryClient } from '@tanstack/react-query';")
            break

# 3) Ensure `const queryClient = useQueryClient();` inside component body
joined = "\n".join(lines)
if "useQueryClient()" not in joined:
    # find the first component body "{" after a function/const component declaration
    insert_i = None
    for i, ln in enumerate(lines):
        if re.search(r"(function\s+\w+|\bconst\s+\w+\s*=\s*\()", ln) and "{" in ln:
            insert_i = i + 1
            break
        if re.search(r"(export\s+function\s+\w+)", ln) and "{" in ln:
            insert_i = i + 1
            break
    if insert_i is None:
        # fallback: first line with only "{"
        for i, ln in enumerate(lines):
            if ln.strip() == "{":
                insert_i = i + 1
                break
    if insert_i is None:
        raise SystemExit("ERROR: cannot find component body to insert useQueryClient()")

    # indent: use the next line's indent, else two spaces
    indent = "  "
    if insert_i < len(lines):
        m = re.match(r"^(\s*)", lines[insert_i])
        if m: indent = m.group(1) or "  "
    lines.insert(insert_i, f"{indent}const queryClient = useQueryClient();")
    lines.insert(insert_i+1, f"{indent}// Phase7.5: Retry invalidates queries after successful flush (keeps UI consistent).")

# 4) Patch flushAll call to invalidateQueries
out = []
patched_flush = 0
for ln in lines:
    if ".flushAll(" in ln and "invalidateQueries" not in ln:
        # case A: awaited line
        if re.search(r"\bawait\s+.*\.flushAll\(", ln):
            out.append(ln)
            indent = re.match(r"^(\s*)", ln).group(1)
            out.append(f"{indent}await queryClient.invalidateQueries();")
            patched_flush += 1
            continue

        # case B: plain call - chain then()
        # replace first occurrence of ".flushAll(...)" with ".flushAll(...).then(() => queryClient.invalidateQueries())"
        ln2 = re.sub(r"(\.flushAll\(\s*\))", r"\1.then(() => queryClient.invalidateQueries())", ln, count=1)
        out.append(ln2)
        patched_flush += 1
        continue

    out.append(ln)

if patched_flush < 1:
    print("⚠️ did not find any .flushAll() call to patch in", target)
    print("   (If Retry uses flushKey or custom handler, we will patch that next.)")

Path(target).write_text("\n".join(out) + "\n", encoding="utf-8")
print("✅ patched:", target)
