# momoya

情侣日常记录小程序 monorepo：`apps/server`（NestJS + MongoDB + Redis + Socket.IO）、`apps/mobile`（Taro 微信小程序）。

## 环境要求

- **Node.js**：与 `package.json` 中 `packageManager` 的 pnpm 版本一致的环境（见根目录 `package.json`）。
- **pnpm**、**Git**
- **Docker** + **Docker Compose**（`docker compose`）：起本地/生产依赖服务时用

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

根目录 `postinstall` 会构建 `packages/shared`。

### 2. 后端环境变量

首次从模板复制并按需修改：

```bash
cp apps/server/.env.example apps/server/.env
```

本地连 Docker 里的服务时，默认应包含（与 `apps/server/.env.example` 一致）：

- `MONGODB_URI=mongodb://127.0.0.1:27017/momoya`（下述 compose 会映射 `27017`）
- `REDIS_URL=redis://127.0.0.1:6379`（**必填**：无 Redis 时服务在启动阶段会失败）

### 3. 启动开发依赖（Mongo + Redis + mongo-express）

```bash
pnpm docker:dev:up
```

`docker-compose.yml` 会启动：

- **mongo:7** → 本机 `127.0.0.1:27017`（无鉴权）
- **redis:7** → 本机 `127.0.0.1:6379`
- **mongo-express** → 浏览器 `http://localhost:8081` 查看数据

其他命令：

| 命令 | 说明 |
|------|------|
| `pnpm docker:dev:logs` | 跟日志 |
| `pnpm docker:dev:down` | 停栈，**保留**数据卷 |
| `pnpm docker:dev:reset` | 停栈并**删除**开发卷（清库） |

若本机自装 Mongo 7+，可不用 compose 的 mongo，但仍需 **Redis** 与上面的 `REDIS_URL`。

### 4. 运行应用

```bash
# 同时：shared watch + 小程序 + Nest（需已 docker:dev:up）
pnpm dev
```

或拆开：

```bash
pnpm build:shared && pnpm dev:server   # 仅 API，默认 http://localhost:3000
pnpm dev:weapp                         # 仅小程序
```

- HTTP API 前缀：`/api/v1`；健康检查：`GET /api/v1/health`。
- 非 `production` 时默认开启 Swagger：UI `http://localhost:3000/api/docs`，OpenAPI `http://localhost:3000/api/docs-json`（与 Apifox 同步可参见 `apps/server/README.md`）。

### 5. 真机 / 同一局域网调后端（简要）

- 手机上的 `localhost` 不是你的电脑，需用电脑局域网 IP。
- 通过 Taro 环境变量指向该 IP，例如：  
  `TARO_APP_DEV_API_HOST=<你电脑IP> pnpm --filter @momoya/mobile dev:weapp`
- Windows 上若手机连不上，检查防火墙是否放行本机 `3000` 端口、网络是否为专用网络等。
- 微信开发者工具中开发阶段可开「不校验合法域名」。

### 6. 小程序生产包

```bash
pnpm --filter @momoya/mobile build:weapp
```

**上线前**在 `apps/mobile/src/config/index.ts` 将 `PROD_API_BASE` 改为真实线上 API 基地址（须带 `/api/v1` 后缀），当前若为占位 `example.com` 会在运行时报错。

---

## 生产部署（Docker）

适用场景：在机器（例如 `/opt/momoya/api`）上拉代码，用 `docker-compose.prod.yml` 跑 **mongo + redis + 构建后的 server 镜像**。

### 1. 环境文件

```bash
cp .env.docker.example .env.docker
# 按注释修改；至少强密码/随机串：
# MONGO_ROOT_PASSWORD、MOMOYA_APP_PASSWORD
# JWT_ACCESS_SECRET、JWT_REFRESH_SECRET（两密钥须不同，建议各 ≥32 字随机）
```

- `STATIC_BASE_URL` 须与对外的 **HTTPS 域名**一致（例：默认的 `https://api.momoya.store/static`），供上传回显的绝对地址。
- `SERVER_PORT` 为**宿主机**映射端口（见下），与 Nginx `proxy_pass` 一致即可。

### 2. 构建与启动

```bash
pnpm docker:prod:build
pnpm docker:prod:up
pnpm docker:prod:logs
```

无 pnpm 时等价：

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml build
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d
```

- `server` 在容器内监听 `3000`；在宿主机上默认映射为 **`127.0.0.1:${SERVER_PORT:-3000}→3000`**，**仅本机回环**，需由**同机 Nginx** 反代到公网（例如 `api.momoya.store`）。Nginx 需反代整站：API（`/api/v1` 等）与静态资源（`/static`），并配置 WebSocket 升级以支持 Socket.IO。
- 上传文件持久在卷 **`server-uploads`** 中；Mongo 数据在 **`mongo-prod-data`**。

### 3. 升级与下线

```bash
pnpm docker:prod:build
pnpm docker:prod:restart    # 仅重启 server 容器
pnpm docker:prod:down        # 停整栈
```

`MOMOYA_SERVER_TAG` 等由 `.env.docker.example` 说明的变量可用于换镜像 tag。

### 4. 常用命令（与文档一致时可直接用）

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml ps
docker compose --env-file .env.docker -f docker-compose.prod.yml exec mongo mongosh -u root -p <ROOT_PWD> --authenticationDatabase admin
```

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 开发：mongo + redis + mongo-express |
| `docker-compose.prod.yml` | 生产：mongo + redis + server 镜像，server 只绑回环口 |
| `.env.docker.example` | 生产 compose 的 env 模板，复制为 `.env.docker` |
| `apps/server/.env.example` | 本机 `pnpm dev:server` 用 |
| `docker/mongo-init/` | 生产 Mongo 首次初始化应用账号 |
| `apps/server/Dockerfile` | 服务端多阶段构建 |

更细的接口说明、冒烟脚本与排障见 **`apps/server/README.md`**。

---

## 常见问题

- **`docker:prod:up` 报 Mongo 应用账号鉴权失败**：常见是改过 `MOMOYA_APP_PASSWORD` 等，但数据卷里用户已是旧密码。新密码只在你**第一次**起库时从 init 写入。解决：对库 `db.updateUser` 改密，或删掉生产 mongo 数据卷后重建（**会清库**）。
- **本机起不来 Nest**：多是没有 Redis 或未设置 `REDIS_URL`。
- **微信开发者工具样式异常**：可关「自动热重载」后重编译；pnpm 对个别原生依赖的构建已写在根 `package.json` 的 `pnpm.onlyBuiltDependencies` 中。
