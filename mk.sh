cd ~/pc-inventory-master

cat > Makefile <<'EOF'
SHELL := /bin/bash

# ---- configurable ----
SERVER_URL ?= http://127.0.0.1:5001
CLIENT_URL ?= http://127.0.0.1:8090
BACKUP_DIR ?= backups

# ---- helpers ----
.PHONY: help
help:
	@echo "PC Inventory Master - Ops"
	@echo ""
	@echo "Targets:"
	@echo "  make up            - docker compose up -d --build"
	@echo "  make down          - docker compose down"
	@echo "  make restart       - restart server"
	@echo "  make logs          - tail server logs"
	@echo "  make ps            - show containers"
	@echo "  make smoke         - run smoke (health + api + ui) + backup + rotate"
	@echo "  make smoke-noback  - run smoke only (no backup)"
	@echo "  make backup        - run db backup + rotate"
	@echo "  make rotate        - rotate backups only"
	@echo "  make restore DUMP=backups/xxx.dump  - restore from dump"
	@echo "  make psql          - open psql inside db container"
	@echo "  make health        - curl /api/health"
	@echo ""

.PHONY: up
up:
	docker compose up -d --build

.PHONY: down
down:
	docker compose down

.PHONY: restart
restart:
	docker compose restart server

.PHONY: logs
logs:
	docker compose logs -f --tail=120 server

.PHONY: ps
ps:
	docker compose ps

.PHONY: health
health:
	curl -sS $(SERVER_URL)/api/health ; echo

.PHONY: smoke
smoke:
	@chmod +x scripts/smoke.sh scripts/db_backup.sh scripts/backup_rotate.sh || true
	@SERVER_URL=$(SERVER_URL) CLIENT_URL=$(CLIENT_URL) SMOKE_BACKUP=true ./scripts/smoke.sh

.PHONY: smoke-noback
smoke-noback:
	@chmod +x scripts/smoke.sh || true
	@SERVER_URL=$(SERVER_URL) CLIENT_URL=$(CLIENT_URL) SMOKE_BACKUP=false ./scripts/smoke.sh

.PHONY: backup
backup:
	@chmod +x scripts/db_backup.sh scripts/backup_rotate.sh || true
	@./scripts/db_backup.sh
	@./scripts/backup_rotate.sh
	@ls -lt $(BACKUP_DIR) | head || true

.PHONY: rotate
rotate:
	@chmod +x scripts/backup_rotate.sh || true
	@./scripts/backup_rotate.sh
	@ls -lt $(BACKUP_DIR) | head || true

# Usage: make restore DUMP=backups/inventory_db_xxx.dump
.PHONY: restore
restore:
	@if [ -z "$(DUMP)" ]; then \
	  echo "ERROR: missing DUMP=..."; \
	  echo "Example: make restore DUMP=backups/inventory_db_20260113_064158.dump"; \
	  exit 1; \
	fi
	@chmod +x scripts/db_restore.sh || true
	@./scripts/db_restore.sh "$(DUMP)"
	@echo "[make] restore done; running smoke..."
	@$(MAKE) smoke-noback

.PHONY: psql
psql:
	docker compose exec db psql -U admin -d inventory_db
EOF

# 快速确认 Makefile 里确实有 help/smoke
grep -nE '^(help:|smoke:|smoke-noback:|backup:|restore:)' Makefile

make help
make smoke
