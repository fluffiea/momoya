# Momoya

pnpm monorepo：`apps/web`（Vite + React）、`apps/api`（Express + Mongo）、`packages/shared`。

**生产**：Docker Compose 起 `mongo`、`api`（容器名 **`momoya-web-api`**）、`web`（**`momoya-web`**）。你已用网关 Nginx 把 **`momoya.store`** 指到 **`momoya-web:80`**；本仓库 **`web` 镜像内只提供静态页**。浏览器请求 **`https://momoya.store/api/*`** 须由网关再反代到 **`http://momoya-web-api:4000`**（与 `location /` 并列、`^~ /api/` 在前）。`docker-compose.prod.yml` 已将 **`api` / `web` 加入 `momoya-bridge`**，与网关同网即可解析上述主机名。

---

## 本地开发

**环境**：Node 20、pnpm（与根目录 `packageManager` 一致）、Docker。

```bash
docker compose up -d
cp .env.example apps/api/.env
```

编辑 `apps/api/.env`：至少 `MONGODB_URI=mongodb://127.0.0.1:27017/momoya`、`SESSION_SECRET`、`PORT=4000`（其余见 `.env.example`）。

```bash
pnpm install
pnpm seed          # 可选，首次账号/种子数据
pnpm dev           # web: http://localhost:5173 ，api: http://127.0.0.1:4000
```

单独起：`pnpm dev:web` / `pnpm dev:api`。质量：`pnpm lint`、`pnpm typecheck`。

---

## 服务器部署（`/opt/momoya/web` + Docker）

目标：**代码在 `/opt/momoya/web`**，日常 **`git push` → 服务器 `git pull` → 启动/更新容器**。

### 前提（一次性）

- 已安装 **Docker** 与 **Compose v2**。
- 已存在 **`momoya-bridge`**，且网关与本栈的 **`momoya-web`、`momoya-web-api` 都在该网络上**（`docker network create momoya-bridge` 若尚未创建）。
- 网关已对 **`momoya.store`** 配置 **`/` → `momoya-web:80`**，并对 **`/api/` → `momoya-web-api:4000`**（含 `X-Forwarded-Proto`；上传/SSE 按需调 `client_max_body_size`、`proxy_buffering off`）。

### 首次

```bash
sudo mkdir -p /opt/momoya && sudo chown "$USER:$USER" /opt/momoya
git clone <仓库 URL> /opt/momoya/web
cd /opt/momoya/web
cp .env.production.example .env.production
```

编辑 `.env.production`：`SESSION_SECRET`、`PROFILE_SECRET_KEY`、`MOMOYA_IMAGE_PREFIX`（如 `ghcr.io/你的github小写名`）、`MOMOYA_IMAGE_TAG`（常用 `latest`）。拉私有镜像前：`docker login ghcr.io`。

**启动（二选一）**

- **用 GHCR 预构建镜像**（推过 `main` 且 Actions 成功）：  
  `docker compose --env-file .env.production -f docker-compose.prod.yml pull api web && docker compose --env-file .env.production -f docker-compose.prod.yml up -d`
- **在服务器当场构建**（无 GHCR 或应急）：  
  `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build`

首次建库后可灌种子（密码自行替换）：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec \
  -e SEED_PASSWORD_JIANGJIANG='<密码>' \
  -e SEED_PASSWORD_MENGMENG='<密码>' \
  api node dist/scripts/seed.js
```

### 日常更新（git push → pull → 起）

**本机**：`git push`（若用 GHCR，等 Actions 打完镜像）。

**服务器**：

```bash
cd /opt/momoya/web
bash deploy/server-update.sh
```

默认：`git pull --ff-only` → `pull api web` → `up -d`。**只在服务器构建、不拉远程镜像**时：

```bash
bash deploy/server-update.sh --build
```

查看：`docker compose --env-file .env.production -f docker-compose.prod.yml ps` / `logs --tail=50 api`。

**停机（保留数据卷）**：`docker compose --env-file .env.production -f docker-compose.prod.yml down`（不要加 `-v`）。

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 本地只起 Mongo |
| `docker-compose.prod.yml` | 生产：mongo + api + web |
| `Dockerfile.api` / `Dockerfile.web` | 镜像构建 |
| `deploy/nginx.conf` | 打入 `momoya-web`：仅静态 SPA（:80） |
| `deploy/server-update.sh` | 服务器：`pull` + 更新容器（支持 `--build`） |
| `.env.production.example` | 生产环境变量模板 |

更长的空机、备份、排障见 [DEPLOYMENT.md](./DEPLOYMENT.md)。
