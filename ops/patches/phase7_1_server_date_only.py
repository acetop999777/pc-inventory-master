import re
from pathlib import Path

p = Path("server/index.js")
s = p.read_text(encoding="utf-8", errors="ignore")

# --- 1) fmtDate: force date-only YYYY-MM-DD ---
# Support a couple of common legacy shapes:
#   const fmtDate = (d) => d ? new Date(d).toISOString() : '';
#   const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';
fmt_re = re.compile(r"^const\s+fmtDate\s*=\s*\(d\)\s*=>\s*(.+?)\s*;\s*$", re.M)

m = fmt_re.search(s)
if not m:
    raise SystemExit('ERROR: cannot find `const fmtDate = (d) => ...;` in server/index.js')

# Replace whole fmtDate line with the contract version
s = fmt_re.sub(
    "// Contract: date-only YYYY-MM-DD\n"
    "const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';\n",
    s,
    count=1
)

# Ensure toDateOnly helper exists right after fmtDate (idempotent)
if "const toDateOnly" not in s:
    insert_after = re.search(r"^const\s+fmtDate.*\n", s, flags=re.M)
    if not insert_after:
        raise SystemExit("ERROR: fmtDate insertion point not found")

    helper = (
        "\n"
        "// DB write helper: accept 'YYYY-MM-DD' or ISO string; returns null/DATE\n"
        "const toDateOnly = (v) => {\n"
        "  if (!v) return null;\n"
        "  if (typeof v === 'string') return v.slice(0, 10);\n"
        "  try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }\n"
        "};\n"
    )
    pos = insert_after.end()
    s = s[:pos] + helper + s[pos:]


# --- 2) Normalize write path: replace any c.orderDate||null and c.deliveryDate||null ---
def replace_all_or_fail(text: str, pattern: str, repl: str, label: str) -> str:
    new_text, n = re.subn(pattern, repl, text)
    if n < 1:
        raise SystemExit(f"ERROR: `{label}` pattern not found. Please search server/index.js for {label}.")
    print(f"✅ replaced {label}: {n} occurrence(s)")
    return new_text

# Handle a few equivalent forms (|| null, ? : null)
order_pat = r"c\.orderDate\s*(\|\|\s*null|\?\s*c\.orderDate\s*:\s*null)"
delivery_pat = r"c\.deliveryDate\s*(\|\|\s*null|\?\s*c\.deliveryDate\s*:\s*null)"

s = replace_all_or_fail(s, order_pat, "toDateOnly(c.orderDate)", "c.orderDate||null")
s = replace_all_or_fail(s, delivery_pat, "toDateOnly(c.deliveryDate)", "c.deliveryDate||null")

# Write back (normalize newlines)
s = s.replace("\r\n", "\n").replace("\r", "\n")
p.write_text(s, encoding="utf-8")
print("✅ phase7_1 applied: server/index.js")
