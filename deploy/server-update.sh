#!/usr/bin/env bash
# 服务器：git pull → 更新并启动 compose（默认拉 GHCR 镜像；可加 --build 在本地构建）
# 用法：cd /opt/momoya/web && bash deploy/server-update.sh
#       cd /opt/momoya/web && bash deploy/server-update.sh --build
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE=".env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 ${ENV_FILE}，请先：cp .env.production.example .env.production 并填写密钥与 MOMOYA_IMAGE_PREFIX" >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)

git pull --ff-only

if [[ "${1:-}" == "--build" ]]; then
  "${COMPOSE[@]}" up -d --build
else
  "${COMPOSE[@]}" pull api web
  "${COMPOSE[@]}" up -d
fi

"${COMPOSE[@]}" ps
