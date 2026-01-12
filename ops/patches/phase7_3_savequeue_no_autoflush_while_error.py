import re
from pathlib import Path

p = Path("client/src/app/saveQueue/SaveQueue.ts")
src = p.read_text(encoding="utf-8", errors="ignore").splitlines()

joined = "\n".join(src)
if "keep accumulating patches but don't auto-flush" in joined:
    print("ℹ️ SaveQueue.ts already patched for Phase7.3; skipping.")
    raise SystemExit(0)

# Find an enqueue* method and insert a guard before the first auto-flush trigger (schedule/flushKey)
method_start_re = re.compile(r"^\s*(public\s+|private\s+|protected\s+)?enqueue\w*\s*\(")

def brace_delta(line: str) -> int:
    return line.count("{") - line.count("}")

out = []
i = 0
changed = False

while i < len(src):
    line = src[i]

    if method_start_re.search(line) and "{" in line:
        # copy method signature
        out.append(line)
        i += 1

        depth = brace_delta(line)
        # Within this method, look for the first auto-flush call
        while i < len(src):
            ln = src[i]
            depth += brace_delta(ln)

            # Insert guard just before first schedule/flushKey invocation
            if (("this.schedule(" in ln) or ("this.flushKey(" in ln) or ("await this.flushKey(" in ln)) and not changed:
                # Only guard if we can see 'st.' referenced in the method (heuristic)
                window = "\n".join(out[-30:]) + "\n" + "\n".join(src[i:i+10])
                if "st." in window:
                    indent = re.match(r"^(\s*)", ln).group(1)
                    guard = [
                        f"{indent}// If we are already in error state, keep accumulating patches but don't auto-flush.",
                        f"{indent}// User must click Retry (or an explicit flush) to attempt again.",
                        f"{indent}if (st.lastError != null) {{",
                        f"{indent}  this.emit();",
                        f"{indent}  return;",
                        f"{indent}}}",
                    ]
                    out.extend(guard)
                    changed = True

            out.append(ln)
            i += 1

            if depth <= 0:
                break

        continue

    out.append(line)
    i += 1

if not changed:
    raise SystemExit("ERROR: Could not find an enqueue* method with an auto-flush call to patch in SaveQueue.ts.")

p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("✅ patched:", p)
