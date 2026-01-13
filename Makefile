SHELL := /bin/bash

.PHONY: help up down restart logs ps build fresh smoke backup restore rotate

help:
	@echo "make up        - docker compose up -d --build"
	@echo "make down      - docker compose down"
	@echo "make restart   - restart server"
	@echo "make logs      - tail logs"
	@echo "make ps        - docker compose ps"
	@echo "make build     - docker compose build"
	@echo "make fresh     - DROP volume and recreate (DANGEROUS)"
	@echo "make smoke     - run smoke test (includes backup + rotate)"
	@echo "make backup    - db backup"
	@echo "make restore f=backups/xxx.dump - db restore from dump"
	@echo "make rotate    - rotate backups"

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart server

logs:
	docker compose logs --tail=200 -f

ps:
	docker compose ps

build:
	docker compose build

fresh:
	docker compose down
	docker volume rm pc-inventory-master_pgdata || true
	docker compose up -d --build
	docker compose logs --tail=120 server

smoke:
	./scripts/smoke.sh

backup:
	./scripts/db_backup.sh

restore:
	@if [ -z "$(f)" ]; then echo "Usage: make restore f=backups/xxx.dump"; exit 2; fi
	./scripts/db_restore.sh "$(f)"

rotate:
	./scripts/backup_rotate.sh
