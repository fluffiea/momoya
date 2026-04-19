# Momoya

pnpm monorepo：**`apps/web`**（Vite + React + React Router）、**`apps/api`**（Express + MongoDB 会话）、**`packages/shared`**（共享类型）。本地开发时前端通过 Vite 把 `/api` 代理到本机 API。

文档覆盖：**Docker 部署（推荐）**、**裸金属部署**、**本地开发**、**构建产物**、**环境变量**、**Pages 与跨域注意点**。

> 🚀 **想直接上线？** 完整部署手册在 **[DEPLOYMENT.md](./DEPLOYMENT.md)**——从空服务器到上线、备份、灾备、故障排查，按顺序复制粘贴即可。

---

## Docker 部署（推荐）

完整的"从零到上线"操作手册见 **[DEPLOYMENT.md](./DEPLOYMENT.md)**——包含服务器初始化、HTTPS、备份、灾备、故障排查全流程，按顺序复制粘贴即可。

简版 4 步速览：

```bash
# 1) 在服务器上拉代码
git clone <仓库地址> /opt/momoya && cd /opt/momoya

# 2) 生成密钥并软链为 .env（让 docker compose 自动读取）
cat > .env.production <<EOF
SESSION_SECRET=$(openssl rand -hex 32)
PROFILE_SECRET_KEY=$(openssl rand -hex 32)
WEB_PORT=8080
EOF
chmod 600 .env.production
ln -s .env.production .env

# 3) 启动
docker compose -f docker-compose.prod.yml up -d --build

# 4) 灌入两个用户（jiangjiang / mengmeng）—— 密码由你自己定，下面两个占位符替换为真实密码
docker compose -f docker-compose.prod.yml exec \
  -e SEED_PASSWORD_JIANGJIANG=<你想要的密码> \
  -e SEED_PASSWORD_MENGMENG=<你想要的密码> \
  api node dist/scripts/seed.js
```

> 项目**没有"默认密码"**——`jiangjiang` 和 `mengmeng` 两个账号是 seed 命令现场创建的，密码就是你在第 4 步环境变量里填的那个值。
>
> 如果第 4 步报 `用户已存在`（比如你跑过一次了），密码不会被覆盖。要改密码看 [DEPLOYMENT.md §10.9](./DEPLOYMENT.md#q9忘了用户密码怎么重置)。

服务拓扑：

```
浏览器 ─► nginx (web 容器, ${WEB_PORT:-8080}) ─┬─► / 静态前端
                                                └─► /api/* → api 容器:4000 → mongo 容器:27017
```

- mongo / api **不映射宿主端口**，仅内网可达
- uploads 与 mongo data 各挂 named volume 持久化
- 前端走相对路径 `/api`，同源 cookie，无需 CORS

仓库里已经准备好的文件：

| 文件 | 作用 |
|------|------|
| `Dockerfile.api` | API 多阶段构建（pnpm deploy + sharp 预编译） |
| `Dockerfile.web` | Vite 构建 → nginx:alpine 托管 |
| `deploy/nginx.conf` | SPA fallback + `/api` 反代 + SSE 不缓冲 |
| `docker-compose.prod.yml` | 生产编排：mongo + api + web |
| `.env.production.example` | 密钥模板 |
| `.dockerignore` | 减小构建上下文 |

> ⚠️ **`PROFILE_SECRET_KEY` 一旦上线永远不要换**（数据库里加密昵称/简介的密钥，换了数据全废）。
> ⚠️ **必须配 HTTPS**——session cookie 是 `secure: true`，没 HTTPS 登录直接失败。详见 [DEPLOYMENT.md §3](./DEPLOYMENT.md#3-配置-https必做)。

---

## 裸金属部署（不用 Docker，可选）

目标：用户只访问 **`https://你的域名`**；Nginx 提供静态前端，并把 **`/api` 与 `/api/static`** 转到本机 Node API。**构建前端时不要设置 `VITE_API_BASE_URL`**（或留空），这样浏览器里请求仍是同源 `/api/...`，无需 CORS，会话 Cookie 也按当前代码即可工作。

### 0. 服务器上要有

- **Node.js** 20+、**pnpm**、**git**
- **MongoDB**：本机用仓库自带 **`docker compose up -d`**，或用云厂商托管 Mongo（把 `MONGODB_URI` 写进 `.env`）
- **Nginx**（或 Caddy 等同类反代）+ **TLS 证书**（Let’s Encrypt / 云证书均可）

### 1. 拉代码与安装

```bash
git clone <你的仓库地址> momoya && cd momoya
pnpm install --frozen-lockfile
```

### 2. 配置 `apps/api/.env`

从 `.env.example` 复制为 **`apps/api/.env`**，至少填写生产必填项（见上文表格）：`MONGODB_URI`、`SESSION_SECRET`、`PROFILE_SECRET_KEY`、`PORT`（默认 4000 即可）。**不要**在构建前端时设置 `VITE_API_BASE_URL`（同域方案）。

首次需要演示账号时在本机执行一次（需已配 `SEED_PASSWORD_*`）：

```bash
pnpm seed
```

### 3. 构建

```bash
pnpm build
```

得到 **`apps/web/dist`** 与 **`apps/api/dist`**。

### 4. 常驻运行 API

任选其一，核心是 **`NODE_ENV=production`** 且工作目录能找到 **`apps/api/.env`**（或根目录 `.env`）：

```bash
cd /path/to/momoya/apps/api
NODE_ENV=production pnpm start
```

生产环境建议用 **systemd** 或 **pm2** 守护进程，并保证 **`uploads/avatars`** 与 Mongo 数据一样做持久化（同机目录即可，定期备份）。

### 5. Nginx（示例思路）

- `root` 指向仓库里的 **`apps/web/dist`**  
- `location /`：SPA 需 **`try_files $uri $uri/ /index.html;`**  
- `location /api/`：`proxy_pass http://127.0.0.1:4000;`（与 `PORT` 一致），保留 `Host`、`X-Forwarded-Proto` 等常用头，便于 `trust proxy` 与 HTTPS 判断  

证书配在 Nginx 上终止 TLS 即可；**对外只暴露 443**（和 80 做 ACME 跳转），API 端口不必公网开放。

### 6. 验收

浏览器打开 `https://你的域名` → 注册/登录 → 发一条日常、上传头像；确认 **`/api/static/avatars/`** 图片可打开。

---

## 本地开发部署

### 前置条件

- **Node.js**（建议 20+；CI 使用 Node 24）
- **pnpm**（建议 9+，与 lockfile 一致）
- **Docker Desktop**（用于本地 MongoDB，可选：你也可自备任意可连的 `MONGODB_URI`）

### 1. 启动 MongoDB

仓库根目录：

```bash
docker compose up -d
```

默认暴露 `localhost:27017`，数据卷名 `momoya_mongo_data`。详见根目录 `docker-compose.yml`。

### 2. 环境变量

复制根目录 **`.env.example`**，在以下**任一位置**保存为 `.env`（API 启动时会**依次加载**两处，后加载的会覆盖先加载的同名变量）：

1. **`apps/api/.env`**（推荐，与 API 进程放一起）  
2. **仓库根目录 `.env`**

`apps/api/src/loadEnv.ts` 会先读 `apps/api/.env`，再读根目录 `.env`。

至少配置（与 `.env.example` 一致）：

| 变量 | 说明 |
|------|------|
| `MONGODB_URI` | 默认 `mongodb://127.0.0.1:27017/momoya` |
| `SESSION_SECRET` | 会话签名密钥；**生产不可使用默认值** |
| `PROFILE_SECRET_KEY` | 生产必填，用于加密资料里的显示名与简介（AES-256-GCM）；本地可空（明文存库，仍兼容历史明文） |
| `PORT` | API 端口，默认 `4000` |
| `SEED_PASSWORD_JIANGJIANG` / `SEED_PASSWORD_MENGMENG` | 仅 **`pnpm seed`** 使用，首次初始化两个账号 |

本地前端 **不需要** 设置 `VITE_API_BASE_URL`（留空即可走 Vite 代理）。

**安全提示**：生产环境浏览器与 API 之间应走 **HTTPS**（由反向代理或托管平台终止 TLS）。生产下 API 会启用 **HSTS**（`helmet`）。登录密码在库内为 **bcrypt** 哈希。头像文件落在 API 机器目录 **`apps/api/uploads/avatars/`**，经 **`/api/static/avatars/`** 对外提供。

### 3. 安装依赖

在**仓库根目录**：

```bash
pnpm install
```

### 4. 首次初始化数据（可选）

需 MongoDB 已可连，且 `.env` 中已配置两个 `SEED_PASSWORD_*`：

```bash
pnpm seed
```

### 5. 启动开发服务

根目录一条命令同时起前端 + API：

```bash
pnpm dev
```

| 服务 | 地址 |
|------|------|
| 前端（Vite） | <http://localhost:5173>（`host: 0.0.0.0`，局域网可访问） |
| API（Express） | `http://127.0.0.1:4000`（默认 `PORT`） |

Vite 将 **`/api` 代理到 `http://127.0.0.1:4000`**（见 `apps/web/vite.config.ts`），前端请求仍写相对路径 `/api/...` 即可。

**单独启动**：

```bash
pnpm dev:web   # 仅前端
pnpm dev:api   # 仅 API（tsx watch）
```

---

## 生产 / 预发布构建

### 全仓构建

在仓库根目录：

```bash
pnpm run lint
pnpm run typecheck
pnpm build
```

- **`@momoya/web`**：`apps/web/dist`（静态资源，可部署到任意静态托管或 CDN）  
- **`@momoya/api`**：`apps/api/dist`（编译后的 `src/**/*.ts` → `dist/**/*.js`）  
- **`@momoya/shared`**：随 web/api 构建被 workspace 引用，无需单独对外部署

### 前端生产环境变量（构建时注入）

前端请求 API 的基地址在 **构建时** 通过 **`VITE_API_BASE_URL`** 决定（见 `apps/web/src/lib/api.ts`）：

- **与 API 同域反代**（推荐）：例如站点 `https://example.com`，Nginx 把 `https://example.com/api` 转到 Node，则构建时 **可不设** 或设为空，由页面与 API 同源，**Cookie 会话（`credentials: 'include'`）最省事**。若静态站与 API 不同路径，只要浏览器最终访问的 HTML 与 `/api` 同源即可。  
- **前端与 API 不同源**：构建前设置 **`VITE_API_BASE_URL=https://api.example.com`**（**无尾斜杠**）。此时必须在 API 侧配置 **CORS**（允许前端 `Origin`、`Access-Control-Allow-Credentials: true` 等），并把会话 Cookie 设为 **`SameSite=None; Secure`** 等，否则浏览器不会带登录 Cookie。**当前仓库 API 未内置 CORS 中间件**，跨域部署需要自行加 CORS 或优先采用**同域反代**。

示例（构建带独立 API 域名）：

```bash
cd apps/web
VITE_API_BASE_URL=https://api.example.com pnpm run build
```

或在 CI / Docker build 阶段注入同名环境变量后再执行 `pnpm build` / `pnpm --filter @momoya/web build`。

### 运行生产 API

1. 构建：`pnpm --filter @momoya/api build`（或根目录 `pnpm build`）  
2. 设置 **`NODE_ENV=production`**，并保证 `.env` 中 **`SESSION_SECRET`**、**`PROFILE_SECRET_KEY`** 已配置（否则进程会退出，见 `apps/api/src/index.ts`）。  
3. 启动：

```bash
cd apps/api
NODE_ENV=production pnpm start
# 等价：node dist/src/index.js
```

需长期可用的 **MongoDB**；**头像目录** `apps/api/uploads/avatars` 需持久化（挂载卷或同步备份），否则换机/重装会丢文件。

监听地址当前为 `app.listen(PORT)` 默认行为（本机全接口）；若只对内网开放，可配合防火墙或反代。

### 静态前端预览（本地 smoke）

```bash
pnpm preview
```

等价于 `pnpm --filter @momoya/web preview`，用于本地查看 `vite build` 产物；**不替代**生产 Nginx / CDN 配置。

---

## CI：GitHub Pages（仅静态前端）

`.github/workflows/deploy.yml` 在 **`main`** 推送（或手动 `workflow_dispatch`）时：

1. `pnpm install --frozen-lockfile`  
2. `pnpm run lint`、`pnpm run typecheck`  
3. `pnpm build`  
4. 将 **`apps/web/dist`** 作为 Pages 产物部署  

**注意**：Pages 只托管**静态前端**，**不包含** Node API 与 MongoDB。你需要：

- 自行托管 API（云主机、容器、Serverless 等），并配置 MongoDB；  
- 在构建 Web 时设置 **`VITE_API_BASE_URL`** 指向该 API（见上文）；或在同一域名下用反代把 `/api` 指到 API（此时可按同域方式构建）。

若 API 与 Pages 域名不同且未做 CORS + Cookie 策略，登录态会失败。

---

## 常用脚本（根目录）

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 并行启动 web + api |
| `pnpm dev:web` / `pnpm dev:api` | 单独启动 |
| `pnpm build` | 构建所有 workspace |
| `pnpm lint` / `pnpm typecheck` | 全仓检查 |
| `pnpm seed` | 初始化种子账号与示例数据（需 Mongo + 环境变量） |
| `pnpm preview` | 本地预览 web 生产构建 |

---

## 技术栈速览

- 前端：React 19、Vite 7、Tailwind CSS 4、React Router 7  
- 后端：Express 4、Mongoose、express-session（Mongo 存会话）、helmet、multer（头像）  
- 包管理：pnpm workspace
