SHELL := /bin/bash

.PHONY: help up down rebuild ps logs smoke backup restore rotate dbshell servershell fresh

help:
	@echo "Targets:"
	@echo "  up        - docker compose up -d --build"
	@echo "  down      - docker compose down"
	@echo "  rebuild   - rebuild server+client (no cache)"
	@echo "  ps        - docker compose ps"
	@echo "  logs      - tail server logs"
	@echo "  smoke     - run smoke + backup + rotate"
	@echo "  backup    - db backup"
	@echo "  restore   - restore from FILE=backups/xxx.dump"
	@echo "  rotate    - rotate backups"
	@echo "  dbshell   - open psql shell"
	@echo "  servershell - open server shell"
	@echo "  fresh     - down -v then up (DANGEROUS: wipes db volume)"

up:
	docker compose up -d --build

down:
	docker compose down

rebuild:
	docker compose build --no-cache server client

ps:
	docker compose ps

logs:
	docker compose logs -f --tail=120 server

smoke:
	./scripts/smoke.sh

backup:
	./scripts/db_backup.sh

rotate:
	./scripts/backup_rotate.sh

restore:
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backups/xxx.dump"; exit 1; fi
	./scripts/db_restore.sh "$(FILE)"

dbshell:
	docker compose exec db psql -U $${POSTGRES_USER:-admin} -d $${POSTGRES_DB:-inventory_db}

servershell:
	docker compose exec server sh

fresh:
	@echo "DANGER: wiping db volume..."
	docker compose down -v
	docker compose up -d --build
