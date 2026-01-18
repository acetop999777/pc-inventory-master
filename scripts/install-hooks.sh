#!/usr/bin/env bash
set -euo pipefail

HOOK=".git/hooks/pre-push"
cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "[hook] running scripts/verify.sh ..."
bash scripts/verify.sh
EOF
chmod +x "$HOOK"
echo "✅ installed pre-push hook: $HOOK"
