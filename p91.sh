cd ~/pc-inventory-master

# 0) 备份旧 compose
if [ -f docker-compose.yml ]; then
  cp -av docker-compose.yml "docker-compose.yml.bak_$(date +%Y%m%d_%H%M%S)"
fi

# 1) 覆盖写入 docker-compose.yml
cat > docker-compose.yml <<'YAML'
# docker-compose.yml
# pc-inventory-master (server + db + client)
# Ports:
#   client: 8090 -> 80
#   server: 5001 -> 5000
#   db:     5433 -> 5432

services:
  db:
    image: postgres:15-alpine
    container_name: pc_inv_db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me}
      POSTGRES_DB: ${POSTGRES_DB:-inventory_db}
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB -h 127.0.0.1 -p 5432",
        ]
      interval: 5s
      timeout: 3s
      retries: 30

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: pc_inv_server
    restart: always
    environment:
      PORT: "5000"
      POSTGRES_HOST: ${POSTGRES_HOST:-db}
      POSTGRES_USER: ${POSTGRES_USER:-admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me}
      POSTGRES_DB: ${POSTGRES_DB:-inventory_db}
      # optional: set SEED=true to insert demo data
      SEED: ${SEED:-false}
    ports:
      - "5001:5000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      # node:alpine typically has wget but not curl
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:5000/api/health >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 12

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: pc_inv_client
    restart: always
    ports:
      - "8090:80"
    depends_on:
      server:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 12

volumes:
  pgdata:
    name: pc-inventory-master_pgdata
YAML

# 2) 确保 .env 里是正确的密码（你刚刚把 DB 用户密码改成了 change_me）
touch .env
if grep -q '^POSTGRES_PASSWORD=' .env; then
  sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=change_me/' .env
else
  echo 'POSTGRES_PASSWORD=change_me' >> .env
fi
if ! grep -q '^POSTGRES_USER=' .env; then echo 'POSTGRES_USER=admin' >> .env; fi
if ! grep -q '^POSTGRES_DB=' .env; then echo 'POSTGRES_DB=inventory_db' >> .env; fi
if ! grep -q '^POSTGRES_HOST=' .env; then echo 'POSTGRES_HOST=db' >> .env; fi

# 3) 重新启动（重建镜像）
docker compose up -d --build

# 4) 看状态 + 跑 smoke
docker compose ps
./scripts/smoke.sh
