from pathlib import Path

p = Path("client/src/app/saveQueue/SaveQueue.ts")
s = p.read_text(encoding="utf-8", errors="ignore").splitlines()

# If already patched, do nothing
joined = "\n".join(s)
if "DO NOT auto-retry (avoid retry storms)" in joined or "if (st.lastError == null)" in joined:
    print("ℹ️ SaveQueue.ts already appears patched; skipping.")
    raise SystemExit(0)

out = []
i = 0
changed = False

while i < len(s):
    line = s[i]
    if ".finally(async () => {" in line:
        # capture indentation
        indent = line.split(".finally", 1)[0]
        # We expect a block ending with "});"
        block = [line]
        i += 1
        while i < len(s):
            block.append(s[i])
            if s[i].strip() == "});":
                break
            i += 1

        block_text = "\n".join(block)

        # Only replace the specific old behavior:
        # st.inFlight = null;
        # if (st.patch !== undefined) { await this.flushKey(key); return; }
        if (
            "st.inFlight = null;" in block_text
            and "if (st.patch !== undefined) {" in block_text
            and "await this.flushKey(key);" in block_text
            and "this.resolveIfIdle(st);" in block_text
            and "this.emit();" in block_text
        ):
            new_block = [
                f"{indent}.finally(async () => {{",
                f"{indent}  st.inFlight = null;",
                f"{indent}  // If new patch arrived while we were in-flight:",
                f"{indent}  // - If the last attempt succeeded, flush again immediately.",
                f"{indent}  // - If the last attempt failed, DO NOT auto-retry (avoid retry storms).",
                f"{indent}  if (st.patch !== undefined) {{",
                f"{indent}    if (st.lastError == null) {{",
                f"{indent}      await this.flushKey(key);",
                f"{indent}      return;",
                f"{indent}    }}",
                f"{indent}    this.emit();",
                f"{indent}    return;",
                f"{indent}  }}",
                f"{indent}  this.resolveIfIdle(st);",
                f"{indent}  this.emit();",
                f"{indent}}});",
            ]
            out.extend(new_block)
            changed = True
            i += 1
            continue
        else:
            # not the expected finally block; keep as-is
            out.extend(block)
            i += 1
            continue

    out.append(line)
    i += 1

if not changed:
    raise SystemExit("ERROR: could not find the expected SaveQueue finally() block to patch.")

p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("✅ patched:", p)
