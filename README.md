# pc-inventory-master

PC inventory + client management system.

## Services

- `client/`: React (CRA) UI
- `server/`: Node/Express API + Postgres
- `docker-compose.yml`: production-style build (nginx-served client)
- `docker-compose.dev.yml`: dev override (hot reload + server watch)

## Quick start

### Dev (hot reload)

```bash
cd pc-inventory-master
./mk.sh dev
```

- UI: `http://localhost:8090`
- API: `http://localhost:5001/api/health`
- DB: `localhost:5433` (Postgres)

### Prod-style (nginx static client)

```bash
cd pc-inventory-master
docker compose up -d --build
```

## Docs

- `docs/DEVELOPMENT.md`
- `docs/ARCHITECTURE.md`
