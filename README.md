# Momoya

一个为两个人定制的小型 Web 应用。pnpm monorepo。根目录 `package.json` 的 `version` 字段为占位（当前为 `0.0.0`）；若需对应某次发行，以 **git tag** 与当时提交为准。

| 包 | 技术栈 | 作用 |
|---|---|---|
| `apps/web` | Vite 7 + React 19 + React Router 7 + Tailwind CSS 4 | 前端 SPA |
| `apps/api` | Express 4 + Mongoose + connect-mongo + sharp + multer | REST API + SSE + 图片处理 |
| `packages/shared` | TypeScript | 前后端共享的类型与 DTO |

---

## 我要做什么？

| 目标 | 看哪份文档 |
|---|---|
| 🛠 **本地开发** | 本文档 [→ §本地开发](#本地开发) |
| 🚀 **第一次部署上线**（空服务器 → 跑起来） | **[DEPLOYMENT.md](./DEPLOYMENT.md)** §0 → §4 |
| 🔄 **日常更新代码到服务器**（已上线，要发新版本） | **[DEPLOYMENT.md §8](./DEPLOYMENT.md#8-升级与回滚)** |
| 🔐 **配 HTTPS 证书** | **[DEPLOYMENT.md §3](./DEPLOYMENT.md#3-配置-https必做)** |
| 💾 **备份 / 灾备 / 迁服务器** | **[DEPLOYMENT.md §6 / §7](./DEPLOYMENT.md#6-备份)** |
| 🩹 **线上出问题排查** | **[DEPLOYMENT.md §10 故障 FAQ](./DEPLOYMENT.md#10-故障排查-faq)** |

---

## 架构概览

### 生产部署拓扑（Docker，三容器）

```
                ┌─────────────────────────────────────────────┐
浏览器  ──HTTPS─►│  web 容器 (nginx:1.27-alpine)               │
                │   listen 80  → 301 跳转到 https              │
                │   listen 443 → 终止 TLS（deploy/certs/*.crt） │
                │     ├── /          静态前端 (SPA fallback)    │
                │     └── /api/* ──► proxy_pass api:4000        │
                └──────────────────────┬──────────────────────┘
                                       │ docker 内网
                              ┌────────▼────────┐
                              │  api 容器        │
                              │  Node 20 + sharp │
                              │  uploads volume  │
                              └────────┬────────┘
                                       │ mongodb://mongo:27017
                              ┌────────▼────────┐
                              │  mongo 容器      │
                              │  mongo:7         │
                              │  data volume     │
                              └─────────────────┘
```

要点：

- **同源部署**：浏览器只访问 `https://域名`，前端走相对路径 `/api`，由 nginx 反代到 api 容器，**没有 CORS、没有跨域 cookie 问题**。
- **mongo 与 api 不暴露宿主端口**，仅在 docker 内网可达。
- **持久化**：两个 named volume `momoya_mongo_data`、`momoya_uploads`（实际 docker 名字会带项目前缀 `momoya_`）。
- **HTTPS 由 web 容器自己处理**，证书文件挂在 `deploy/certs/`，不依赖 Caddy / Cloudflare 这类外部反代。
- **session 存 mongo**（`connect-mongo`），api 容器重启**不会**让用户掉线。
- **api 容器有 gosu entrypoint**，启动前自动 chown uploads volume，避免 named volume 默认归 root 导致的写入失败。

### 关键技术决策（一句话原因）

| 选择 | 原因 |
|---|---|
| sharp 在 debian-slim 上跑（不是 alpine） | 官方预编译二进制只支持 glibc，alpine 用 musl 要源码编译 |
| `pnpm deploy` 单独导出 api | 让 runtime 镜像只装 api 一个包的依赖，不带整个 workspace |
| connect-mongo 存 session | 14 天滚动续期；api 容器重启 / 滚动发布不掉线 |
| nginx `proxy_buffering off` 在 `/api/` | SSE 实时事件需要立即推送，不能被缓冲 |
| 头像 sharp 处理（512×512 webp） | 用户上传任意比例图，统一裁正方形避免黑边 |
| 日常列表 cursor 分页 | 避免一次性加载所有日常导致前端崩溃 |

---

## 仓库内的关键文件

| 文件 | 作用 |
|---|---|
| `Dockerfile.api` | API 多阶段构建：pnpm install + tsc → pnpm deploy → 最小 runtime（gosu + nodejs:1001） |
| `Dockerfile.web` | Web 多阶段构建：Vite build → nginx:alpine 静态托管 |
| `deploy/nginx.conf` | 80→443 跳转、443 SSL 终止、SPA fallback、`/api` 反代、SSE 不缓冲 |
| `deploy/api-entrypoint.sh` | api 容器启动前 chown uploads，再用 gosu 降权到 nodejs |
| `deploy/certs/.gitkeep` | 证书目录占位，真证书 `cert.crt` / `cert.key` 由 `.gitignore` 排除 |
| `docker-compose.prod.yml` | 生产编排：mongo + api + web；api/web 使用 GHCR 镜像（可应急 `build`） |
| `.github/workflows/docker-publish.yml` | push 到 `main`/`master` 时构建并推送 `momoya-api` / `momoya-web` 到 GHCR |
| `deploy/server-update.sh` | 服务器上一键：`git pull` + `docker compose pull` + `up -d` |
| `docker-compose.yml` | **仅本地开发**：只起 mongo |
| `.env.production.example` | 生产密钥 + GHCR 镜像前缀（`MOMOYA_IMAGE_PREFIX` / `MOMOYA_IMAGE_TAG`）模板 |
| `.env.example` | 本地开发环境变量模板 |
| `.dockerignore` | 排除 node_modules / dist / 上传目录，加速构建 |
| `apps/api/scripts/seed.ts` | 灌入 jiangjiang / mengmeng 两个账号 + 默认日常条目 |

---

## 本地开发

### 前置

- **Node.js** 20+（与 `Dockerfile.api` / `Dockerfile.web` 中 `NODE_VERSION` 一致；本地开发建议同主版本）
- **pnpm** 10.30.1（与 `package.json` 中的 `packageManager` 一致；用 `corepack enable` 自动切换）
- **Docker Desktop**（用来本地起 mongo；不想装也可自备 mongo 实例）

### 1. 起 MongoDB

仓库根目录：

```powershell
docker compose up -d
```

会用根目录的 `docker-compose.yml` 起一个 mongo 容器，监听 `localhost:27017`，数据存在 named volume `momoya_mongo_data`。

### 2. 写本地 `.env`

复制根目录 `.env.example` → `apps/api/.env`（**推荐**，与 api 进程放一起）：

```powershell
# Windows PowerShell
copy .env.example apps\api\.env
```

```bash
# Linux / macOS
cp .env.example apps/api/.env
```

至少填好：

| 变量 | 本地推荐值 |
|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/momoya` |
| `SESSION_SECRET` | 任意长字符串（生产必须换强随机串） |
| `PROFILE_SECRET_KEY` | 留空（本地明文存库即可；生产**必填**且**永不可换**） |
| `PORT` | `4000` |
| `SEED_PASSWORD_JIANGJIANG` | 任意值，仅 `pnpm seed` 时用到 |
| `SEED_PASSWORD_MENGMENG` | 同上 |

> `apps/api/src/loadEnv.ts` 会先读 `apps/api/.env`，再读根目录 `.env`，后者会覆盖前者的同名变量。

### 3. 装依赖

```powershell
pnpm install
```

### 4. 灌种子数据（首次或想重置时）

确保 mongo 已起、`SEED_PASSWORD_*` 已填：

```powershell
pnpm seed
```

会创建 `jiangjiang` / `mengmeng` 两个账号 + 一条默认日常。**已存在的用户会跳过、不覆盖密码**。

### 5. 启动 dev server

```powershell
pnpm dev
```

| 服务 | 地址 |
|---|---|
| 前端（Vite） | <http://localhost:5173>（host 0.0.0.0，局域网可访问） |
| API（Express，tsx watch） | <http://127.0.0.1:4000> |

Vite 配置里把 `/api/*` 代理到 `127.0.0.1:4000`，所以前端代码写相对路径就行（参考 `apps/web/vite.config.ts`）。

**单独启动**：

```powershell
pnpm dev:web   # 仅前端
pnpm dev:api   # 仅 API
```

### 6. 检查代码

```powershell
pnpm lint
pnpm typecheck
```

---

## 根目录脚本一览

| 脚本 | 等价于 | 用途 |
|---|---|---|
| `pnpm dev` | concurrently 起 web + api | 日常开发 |
| `pnpm dev:web` / `pnpm dev:api` | 单独起 | 调试单端 |
| `pnpm build` | `pnpm -r run build` | 产出 `apps/web/dist`、`apps/api/dist` |
| `pnpm lint` | `pnpm -r run lint` | ESLint 9 |
| `pnpm typecheck` | `pnpm -r run typecheck` | tsc --noEmit |
| `pnpm seed` | `pnpm --filter @momoya/api seed` | 灌种子数据 |
| `pnpm preview` | `vite preview` | 本地查看 `vite build` 产物 |
| `pnpm cm` | `git add . && pnpm commit`（commitizen） | 交互式生成 conventional commit |

---

## 上线 / 发布

**完整流程在 [DEPLOYMENT.md](./DEPLOYMENT.md)**（§0～§4：空服务器安装；§8：日常升级）。这里只放最少必要的速览。

### 第一次部署（要点）

1. 服务器完成 **§1**（Docker、`deploy` 用户、防火墙等），在 `/opt/momoya` **clone** 仓库。  
2. 按 **`.env.production.example`** 准备 `.env.production`：除 `SESSION_SECRET`、`PROFILE_SECRET_KEY` 外，还需 **`MOMOYA_IMAGE_PREFIX=ghcr.io/<你的 GitHub 用户名小写>`** 与 **`MOMOYA_IMAGE_TAG=latest`**，并 **`ln -s .env.production .env`**。  
3. **`deploy/certs/`** 放置 `cert.crt` / `cert.key`（可先自签占位，见 DEPLOYMENT §2.3）。  
4. **先**让 GitHub 上 **Actions「Publish Docker images」** 至少成功一次（GHCR 有镜像），再在服务器执行：

```bash
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d
```

若暂时还没有 GHCR 镜像，可应急：`docker compose -f docker-compose.prod.yml up -d --build`（见 DEPLOYMENT §2.4）。私有 GHCR 需先 `docker login ghcr.io`。  
5. **灌种子账号**（密码替换占位符）：

```bash
docker compose -f docker-compose.prod.yml exec \
  -e SEED_PASSWORD_JIANGJIANG=<你的密码> \
  -e SEED_PASSWORD_MENGMENG=<你的密码> \
  api node dist/scripts/seed.js
```

> ⚠️ **`PROFILE_SECRET_KEY` 一旦上线永远不要换** —— 它加密了用户昵称和简介，换了那两个字段全部解不出来。把整个 `.env.production` 备份到密码管理器。  
> ⚠️ **必须配 HTTPS** —— session cookie 在生产是 `secure: true`，没 HTTPS 浏览器不发 cookie，登录会直接挂。

### 日常发布新版本

```bash
# 本地：
git add <files>
git commit -m "feat(scope): xxx"
git push

# 等 GitHub Actions「Publish Docker images」成功后再在服务器执行：
cd /opt/momoya
bash deploy/server-update.sh
# 等价手动：git pull --ff-only && docker compose -f docker-compose.prod.yml pull api web && docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=30 api
```

> 详细说明、数据是否受影响、回滚见 **[DEPLOYMENT.md §8](./DEPLOYMENT.md#8-升级与回滚)**。
>
> ✅ session 存在 mongo 里，api 容器重启 / 重建**不会**让用户掉线，**不需要重新登录**。

---

## GitHub Actions：Docker 镜像发布

推送 `main` 或 `master` 时，`.github/workflows/docker-publish.yml` 会在 GitHub Actions 里构建 `Dockerfile.api` / `Dockerfile.web`，并推送到 **GHCR**（`ghcr.io/<你的 GitHub 用户名小写>/momoya-api` 与 `momoya-web`）。服务器按 [DEPLOYMENT.md §8](./DEPLOYMENT.md#8-升级与回滚) 拉取镜像即可，无需在生产机编译。

---

## 安全提示

- 生产密码全部 **bcrypt 12 轮**哈希存储。
- 资料里的昵称 / 简介在数据库内为 **AES-256-GCM 密文**（密钥 = `PROFILE_SECRET_KEY`）。
- session cookie：`httpOnly` + `sameSite=lax` + 生产强制 `secure`。
- 生产 API 启用了 helmet + HSTS（180 天）。
- 头像文件落在 `apps/api/uploads/avatars/`（容器内 `/app/uploads/avatars`），由 nginx 反代到 `/api/static/avatars/` 对外提供，**带 `Cache-Control: private` 头**。
- 上传图片：multer 按路由限制（头像 **8MB**、日常配图 **15MB**）；nginx `client_max_body_size 12m`，超过 12MB 的请求会先被 nginx 拒绝；sharp 自动裁切 + 转 WebP（头像 512×512）。
