# Development

## Prereqs

- Docker + Docker Compose v2

## Commands

### Dev mode (recommended)

Runs:
- API with auto-restart (`node --watch`)
- UI with hot reload (CRA dev server)

```bash
./mk.sh dev
```

Ports:
- UI: `http://localhost:8090`
- API: `http://localhost:5001`
- DB: `localhost:5433`

### Production-style

Builds:
- `client/` into static assets served by nginx
- `server/` as Node container

```bash
docker compose up -d --build
```

## Env

- Copy `.env.example` to `.env` for local configuration.
- `.env` is intentionally not tracked.

Key variables:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `SEED` (default `false`)

## Tests / verification

Repo includes pre-push verification hooks that run:
- `client`: `npm ci`, `typecheck`, `test:ci`, `build`
- smoke checks against `server` + `client` ports

Manual:
```bash
npm run verify
```

## Common workflows

### “Draft client” workflow (clients)

- New client exists only in memory until `wechatName` becomes non-empty.
- After `wechatName` is set, the full draft snapshot is committed to DB.
- Further edits write through immediately.

### PCPartPicker paste

- Paste list in Specs → parses current paste only (overwrites previous parsed specs).
- Inventory matching is strict: only uses DB item name on high-confidence match; otherwise keeps PCPartPicker text so it can be edited manually.
