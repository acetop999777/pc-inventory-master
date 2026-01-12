import re
from pathlib import Path

p = Path("client/src/app/saveQueue/SaveQueue.ts")
lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()

text = "\n".join(lines)
if "Phase7.3: hold patches while error" in text:
    print("ℹ️ Phase7.3 already applied; skipping.")
    raise SystemExit(0)

def brace_delta(s: str) -> int:
    return s.count("{") - s.count("}")

# --- A) Remove "st.lastError = null" inside enqueue block (keep error sticky) ---
out = []
in_enqueue = False
depth = 0
removed_clear = 0

# match either:
#   enqueue(...) {
#   enqueue = (...) => {
enqueue_start = re.compile(r"^\s*enqueue\b.*(\=\s*\(|\()\s*.*\{\s*$")

for ln in lines:
    if not in_enqueue and enqueue_start.search(ln):
        in_enqueue = True
        depth = brace_delta(ln)
        out.append(ln)
        continue

    if in_enqueue:
        depth += brace_delta(ln)
        # remove only the simple clear line
        if ln.strip() == "st.lastError = null;":
            removed_clear += 1
            out.append("    // Phase7.3: keep lastError sticky while user continues editing; Retry will attempt flush.")
            continue
        out.append(ln)
        if depth <= 0:
            in_enqueue = False
        continue

    out.append(ln)

if removed_clear < 1:
    print("ℹ️ did not find `st.lastError = null;` inside enqueue (maybe already removed)")

# --- B) Add guard inside schedule(...) to skip auto flush when error ---
lines2 = out
out2 = []
patched_schedule = False

schedule_sig = re.compile(r"^(\s*)(private\s+|public\s+|protected\s+)?schedule\s*\((.*)\)\s*\{\s*$")

for ln in lines2:
    m = schedule_sig.match(ln)
    out2.append(ln)
    if m and not patched_schedule:
        indent = m.group(1)
        params = m.group(3)

        # figure out the state param name (usually `st`)
        names = re.findall(r"(?:^|,)\s*([A-Za-z_]\w*)\s*:", params)
        st_name = names[-1] if names else "st"

        guard = [
            f"{indent}  // Phase7.3: hold patches while error (no auto-flush; user must Retry).",
            f"{indent}  if ({st_name}.lastError != null) {{",
            f"{indent}    this.emit();",
            f"{indent}    return;",
            f"{indent}  }}",
        ]
        out2.extend(guard)
        patched_schedule = True

if not patched_schedule:
    raise SystemExit("ERROR: cannot find schedule(...) { ... } in SaveQueue.ts to patch.")

p.write_text("\n".join(out2) + "\n", encoding="utf-8")
print("✅ phase7_3 applied:", p)
