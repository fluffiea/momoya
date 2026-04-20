#!/usr/bin/env bash
# 服务器上发布新版本：拉仓库里的 compose / nginx / 证书路径配置，再从 GHCR 拉 api/web 镜像并启动。
# 用法（在仓库根目录，例如 /opt/momoya）：
#   bash deploy/server-update.sh
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
git pull --ff-only
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
