# momoya

情侣日常 monorepo：`packages/shared`（类型与常量）、`apps/server`（NestJS 11 + Mongo + Redis + Socket.IO）、`apps/mobile`（Taro 4 微信）。

**环境**：Node **20**、**pnpm@10.33.0**（见根 `packageManager`）、**Git**、**Docker Compose**（`docker compose`）。

**结构**：`packages/shared` 在 `pnpm install` 的 `postinstall` 中构建为 `dist`；`apps/server` 本机默认可访问 `http://localhost:3000`；`apps/mobile` 通过 `TARO_APP_*` 与后端联调。更细的说明见 [**apps/server/README.md**](apps/server/README.md)。

---

## 本地开发

```bash
pnpm install
```

```bash
# 起 mongo:7、redis:7、mongo-express（端口：27017 / 6379 / 8081）
pnpm docker:dev:up
```

```bash
# 后端环境变量
cp apps/server/.env.example apps/server/.env
```

```powershell
# Windows (PowerShell)
Copy-Item apps\server\.env.example apps\server\.env
```

`apps/server/.env` 内至少设 `REDIS_URL=redis://127.0.0.1:6379`（无 Redis 时 Nest 无法启动）和 `MONGODB_URI`（与 compose 一致时多为 `mongodb://127.0.0.1:27017/momoya`）。完整说明见 `apps/server/.env.example` 中注释。

```bash
# 看日志 / 停栈保卷 / 清卷
pnpm docker:dev:logs
pnpm docker:dev:down
pnpm docker:dev:reset
```

本机可自带 Mongo7，**仍须**有可连的 Redis 与 `REDIS_URL`。

```bash
# 先 build:shared 再并行：shared watch、小程序、Nest
pnpm dev
```

或拆开：

```bash
pnpm dev:server
pnpm dev:weapp
```

（需已能连上 Mongo/Redis 且已安装依赖。）

- 路由前缀 `/api/v1`；健康检查 `GET /api/v1/health`；非 production 时 Swagger 默认开（见 `apps/server` README 与 `SWAGGER_ENABLED`）。
- 小程序联调：默认看 `apps/mobile/.env.development`；本机私覆盖用 `apps/mobile/.env.development.local`（不提交）。真机调试可临时指定开发机 IP：

```bash
# 将 192.168.1.23 替换为你的开发机局域网 IP
TARO_APP_DEV_API_HOST=192.168.1.23 pnpm --filter @momoya/mobile dev:weapp
```

```powershell
# 将 192.168.1.23 替换为你的开发机局域网 IP
$env:TARO_APP_DEV_API_HOST="192.168.1.23"; pnpm --filter @momoya/mobile dev:weapp
```

并放行端口（常 3000）。`TARO_APP_WS_URL` 在对应 `.env` 中声明，可为空（见 `apps/mobile/src/config/index.ts`）。`project.private.config.json` 本机/隐私，不提交，缺失时由开发者工具生成。

发正式包：

```bash
pnpm --filter @momoya/mobile build:weapp
```

在 `apps/mobile/src/config/index.ts` 填好 `PROD_API_BASE`（须含 `/api/v1`），并在微信公众平台配置域名/上传/WebSocket 白名单。

---

## 生产部署（Docker）

推荐方式：**本机构建镜像，服务器只加载并运行镜像**。这样服务器不需要 Node/pnpm，也不会生成 `node_modules`。

部署目录示例：`/opt/momoya/api`。该目录里需要有：

- `docker-compose.prod.yml`
- `.env.docker`
- `docker/mongo-init/`（首次创建 Mongo 数据卷时用）

### 1. 服务器只准备一次

```bash
mkdir -p /opt/momoya/api
cd /opt/momoya/api

# 从本项目复制 docker-compose.prod.yml、docker/mongo-init/ 到这里
cp .env.docker.example .env.docker
```

然后编辑 `.env.docker`，填好 Mongo 用户、JWT 密钥、`STATIC_BASE_URL`、`SERVER_PORT` 等。`.env.docker` 是服务器私有文件，不提交。

### 2. 本机每次发布先打包

在本机仓库根目录执行：

```bash
pnpm docker:prod:pack
```

它会自动生成 `年.月.日.时.分.秒` 格式的 tag，例如 `2026.04.27.22.00.00`，并产出：

```bash
artifacts/momoya-server-2026.04.27.22.00.00.tar
```

如果本机和服务器 CPU 架构不同，例如本机 arm64、服务器 amd64，用：

```bash
pnpm docker:prod:pack -- --platform linux/amd64
```

### 3. 上传 tar 到服务器

```bash
scp artifacts/momoya-server-2026.04.27.22.00.00.tar user@server:/opt/momoya/api/
```

### 4. 服务器加载并启动

```bash
cd /opt/momoya/api
docker load -i momoya-server-2026.04.27.22.00.00.tar

# 把 .env.docker 里的 MOMOYA_SERVER_TAG 改成本次 tag
sed -i 's/^MOMOYA_SERVER_TAG=.*/MOMOYA_SERVER_TAG=2026.04.27.22.00.00/' .env.docker

# 首次部署：会启动 mongo、redis、server
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d
docker compose --env-file .env.docker -f docker-compose.prod.yml logs -f server
```

以后更新 server，只换镜像和 server 容器，不重启 Mongo/Redis：

```bash
cd /opt/momoya/api
docker load -i momoya-server-2026.04.27.22.30.00.tar
sed -i 's/^MOMOYA_SERVER_TAG=.*/MOMOYA_SERVER_TAG=2026.04.27.22.30.00/' .env.docker
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d --no-deps server
docker compose --env-file .env.docker -f docker-compose.prod.yml logs -f server
```

`server` 在容器内监听 3000，映到宿主机 `127.0.0.1:SERVER_PORT→3000`（`SERVER_PORT` 在 `.env.docker`），仅经本机 Nginx 对公网；Nginx 需代理 API、`/static` 与 WebSocket（Socket.IO）。数据卷：Mongo `mongo-prod-data`；上传 `server-uploads`（容器内 `/app/uploads`）。首次空卷建库见 `docker/mongo-init/`。

下线整栈时：

```bash
cd /opt/momoya/api
docker compose --env-file .env.docker -f docker-compose.prod.yml down
```

**常见**：改 `.env.docker` 里 Mongo 用户密码后仍鉴权失败，多为老数据卷中用户密码未变，需在库里 `db.updateUser` 或删数据卷重建（会丢数据）。
