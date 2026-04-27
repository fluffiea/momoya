# momoya

情侣日常记录小程序（monorepo）。

- `apps/server`：NestJS 11 服务端（MongoDB + Redis + Socket.IO 实时，与 HTTP 同端口）
- `apps/mobile`：Taro 4.2（Vite）+ React 18 + Tailwind v4 + weapp-tailwindcss + Zustand

当前完成：**M1 基建** · **M2 登录体系**（双 Token + 严格单设备挤占）· **M3 资料编辑 + 图片上传基建** · **M4 日常时间轴**（发布 / 二人共享列表 / 游标分页 / 软删）。

## 快速开始

```powershell
# 1. 安装依赖
pnpm install

# 2. 准备后端 .env（首次）
Copy-Item apps/server/.env.example apps/server/.env

# 3. 启动开发用 MongoDB + Redis（Docker Compose，推荐）
pnpm docker:dev:up

# 4. 同时启动后端与小程序构建
pnpm dev
```

也可以分别运行：

```powershell
pnpm dev:server   # 仅后端
pnpm dev:weapp    # 仅小程序
```

> 如果你本机已经装了 MongoDB 7+，也可以跳过 Compose 里的 mongo 服务，但仍建议 **用 Compose 起 Redis**（`redis:6379` 映射到本机），并在 `apps/server/.env` 中设置 `REDIS_URL=redis://127.0.0.1:6379`（见 `apps/server/.env.example`）。**不设 Redis 或 Redis 未启动时，Nest 进程会在连接 adapter 阶段直接退出。**

### 日常列表实时推送（Socket.IO）

- **App 全局**（已 hydrate、已登录且已绑定伴侣）即连接 Socket.IO；**不要**只在「见证」tab 挂载时才建连——微信小程序 tabBar 子页按需加载，用户从未点开「见证」时见证页不会挂载，会导致双方永远收不到实时事件。
- 与 API **同源**（默认路径 `/socket.io`）。事件：**日常** `daily:created` / `daily:updated` / `daily:deleted`；**报备** `report:created` / `report:updated` / `report:deleted`（报备列表侧收到后走 `refresh` 以对齐筛选）。开发包控制台会打印 `[momoya] couple realtime socket connected`。
- 小程序端默认 `WS_ORIGIN_URL` 与 `API_BASE_URL` 同 host；可用环境变量 **`TARO_APP_WS_URL`** 覆盖（与 `TARO_APP_DEV_API_HOST` 用法类似，见 `apps/mobile/.env.development`）。
- **生产**：需 **WSS** 与合法域名；在微信公众平台配置 **socket 合法域名**（与 request 域名可为同一 HTTPS 域名）。
- **真机调试**：除放行 HTTP **3000** 入站外，若走 WSS/防火墙策略不同，请一并保证 WebSocket 升级流量可达（与 HTTP 同端口时通常无需额外开端口）。

## 接口调试（Apifox / Swagger）

后端启动后默认挂 Swagger：

- UI：`http://localhost:3000/api/docs`
- OpenAPI JSON（供 Apifox 同步）：`http://localhost:3000/api/docs-json`

Apifox 里 **设置 → 数据管理 → 导入数据 → OpenAPI/Swagger → URL 导入**，填入上面的 JSON 地址并开启自动同步即可，后续加接口无需手工维护。详见 `apps/server/README.md#swagger--apifox-对接`。

## M1 验收

- 后端：`GET http://localhost:3000/api/v1/health` 返回 `{ code: 0, data: { status: 'ok', mongo: 'up' }, msg: 'ok' }`。
- 种子用户：启动日志含 `[seed] created initial users: jiangjiang, mengmeng`（或 `[seed] users exist, skipped`）。账号密码：`jiangjiang / 251212`、`mengmeng / 251212`，互为 partner。
- 小程序：用微信开发者工具打开 `apps/mobile/dist`，首页浅粉背景 + 居中显示粉色 `momoya` 标题，Tailwind 工具类全部生效（`dist/app-origin.wxss` 含 `bg-pink-50` 等类且 `rpx` 单位已替换 `rem`）。

## M2 验收

**后端**：

- Swagger UI 里可以看到 `登录鉴权` 分组下 5 个接口，均可直接 Try it out。
- 用 `jiangjiang / 251212` 登录，返回 `{ accessToken, refreshToken, accessExpiresIn: 7200, refreshExpiresIn: 1209600, user }`。
- 带 access token 访问 `/api/v1/auth/me` 返回当前用户；
  用另一台模拟的"第二设备"再登录一次后，第一台的旧 access 立刻收到 `{ code: 40104, errorKey: 'E_SESSION_KICKED' }`。
- `/auth/change-password` 旧密码错误时返回 `{ code: 40105, errorKey: 'E_AUTH_WRONG_OLD_PASSWORD' }`。
- `/auth/logout` 后当前 token 的下一次请求返回 `E_SESSION_KICKED`。
- 参考 `apps/server/README.md#m2-登录鉴权` 有完整 PowerShell 冒烟脚本。

**小程序**：

- `pnpm --filter @momoya/mobile build:weapp` 产出 `pages/login/index`、`pages/me/index`、`pages/me/change-password/index`。
- 首次启动未登录 → 自动 `reLaunch` 到 `/pages/login/index`。
- 登录成功后进入 `/pages/me/index`，显示昵称/用户名/签名，点击"修改密码"跳 `/pages/me/change-password/index`。
- 改密成功后本机保持登录态（接口会返回新 tokens，`authStore` 自动替换）；同时模拟另一设备的登录会导致本机下次请求命中 `E_SESSION_KICKED`，网络层自动 `logout + reLaunch` 回登录页。

## M3 验收

**后端**：

- Swagger UI 新增 `文件上传`、`用户资料` 两个分组，接口 `POST /upload/image` / `PATCH /users/me` 可直接 Try it out（上传需先点左上角 Authorize 塞 access token）。
- 以 `jiangjiang / 251212` 登录 → `POST /upload/image`（`file` 字段 + `image/jpeg|png|webp`）→ 返回 `{ url: "/static/2026/04/<uuid>.png", absoluteUrl, mimeType, size }`。
- `PATCH /users/me` 允许 `nickname (1-20)` / `bio (0-100)` / `avatar (^/static/|http(s)://)`；其它字段（`username` / `partnerId` 等）被 `ValidationPipe` whitelist 拦截。
- 错误分支覆盖：超大 → `E_UPLOAD_TOO_LARGE (413)`、非白名单 MIME → `E_UPLOAD_TYPE (415)`、错字段名 → `E_UPLOAD_MISSING (400)`、未登录 → `E_AUTH_REQUIRED (401)`。
- 直接 `GET http://localhost:3000/static/<相对路径>` 能拿到图片（由 `@nestjs/serve-static` 挂载，不受 `/api/v1` 前缀影响）。
- 参考 `apps/server/README.md#m3-冒烟脚本` 有完整 PowerShell 冒烟。

**小程序**：

- `pnpm --filter @momoya/mobile build:weapp` 产出 `pages/me/edit-profile/index`。
- 我的页面点头像或"编辑资料"入口进入编辑页；点头像触发 `Taro.chooseMedia` 选图，自动上传成功后立即预览（文案变"头像已更新，记得保存"）。
- 保存时只 PATCH 发生了变化的字段；成功后 `authStore.setUser` 同步更新，返回上一页头像/昵称立即反映最新值。
- 头像显示走 `resolveAssetUrl()`：`/static/...` 相对路径自动拼 `STATIC_BASE_URL`，完整 URL 原样透传。
- 展示层统一套一层 `useRemoteImage(url)`：微信基础库 3.x 开始 `<Image src="http://...">` 会被阻断（"不再支持 HTTP 协议"），hook 内部检测到 `http://` 前缀时先走 `Taro.downloadFile` 拿到 `tempFilePath` 再喂给 `<Image>`；`https://` / `wxfile://` 原样透传，所以上线 HTTPS 后无额外开销。
- 生产打包前记得把 `apps/mobile/src/config/index.ts` 的 `PROD_API_BASE` 从 `api.momoya.example.com` 改成真实域名，否则 `resolveApiBase()` 会直接 throw。

> 微信开发者工具联调：**设置 → 项目设置 → 本地设置 → 不校验合法域名**（否则 `localhost` 的 `request` / `uploadFile` / `downloadFile` 都会被拒）。

### 真机预览 / 真机调试（同局域网手机连本机后端）

**常见症状**：开发者工具模拟器里登录 OK，一扫码到手机就"网络请求失败"。根因固定是下面两个之一（通常两个都要解决）：

1. 手机上的 `localhost` 指手机自己，不是你电脑，要让小程序请求走电脑在局域网里的 IPv4。
2. Windows 防火墙默认阻止"公用网络"入站，3000 端口对手机不可达。

**步骤 ①：查出电脑的局域网 IPv4**

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|WLAN|以太网|Ethernet' } | Select-Object InterfaceAlias, IPAddress
# 例：WLAN 10.172.8.129
```

**步骤 ②：让小程序 dev 包指向这个 IP**（通过 Taro 约定的 `TARO_APP_*` 环境变量注入，不用改代码）

```powershell
$env:TARO_APP_DEV_API_HOST = '10.172.8.129'   # 换成你自己的 IP
pnpm --filter @momoya/mobile dev:weapp
# 换电脑或换网络后重跑这行即可；不设置则回退到 localhost（模拟器用）
```

启动后小程序的 `app.onLaunch` 会在 console 打印 `[momoya] API_BASE_URL = ...`，可据此确认注入是否生效。

**步骤 ③：在"管理员 PowerShell"里放行 3000 端口入站**（一次性，命令会持久化）

```powershell
# 放行 3000/TCP 入站，仅 Private/Domain 网络（Public 保持拒绝，安全）
New-NetFirewallRule -DisplayName "momoya dev :3000" -Direction Inbound `
  -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private,Domain

# 顺手把当前 WLAN 网络从 Public 改为 Private（否则上条规则不生效）
Set-NetConnectionProfile -InterfaceAlias WLAN -NetworkCategory Private
```

验证：在本机浏览器打开 `http://<你的IP>:3000/api/v1/health` 能拿到 `{code:0,data:{status:'ok'}}`，手机扫码后登录页即可正常请求。

**步骤 ④：微信开发者工具**

- 保持勾选「不校验合法域名 / TLS 版本 / HTTPS 证书」——真机调试通道下这个开关同样生效。
- 真机调试时点"重新编译"一次，让新的 `API_BASE_URL` 进入 vConsole。

> 扫码"预览"（非真机调试）无法绕过合法域名检查、且必须 HTTPS，所以开发阶段始终走"真机调试"。

## M4 验收

**数据模型**：新增 `moments` 集合，字段 `authorId / text / images[] / deletedAt / createdAt / updatedAt`。不引入 coupleId：双人可见通过 `authorId ∈ {me, partnerId}` 过滤；删除走软删 `deletedAt`。索引 `{ authorId:1, createdAt:-1 }` 与 `{ createdAt:-1, _id:-1 }`。

**后端接口**（Swagger 分组：`日常动态`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/moments` | 发布一条（`text` ≤500、`images` ≤9，至少一项非空；限流 20/min） |
| `GET` | `/moments?cursor=<ts_id>&limit=20` | 按 `(createdAt, _id)` 倒序游标分页，仅返回 `authorId ∈ {me, partnerId}` |
| `DELETE` | `/moments/:id` | 软删；非本人 → `E_MOMENT_FORBIDDEN (40304)`；不存在 → `E_MOMENT_NOT_FOUND (40404)` |
| `GET` | `/users/partner` | 返回当前用户 partner 的 `{id, username, nickname, avatar, createdAt}`；未绑定返回 `null`，供首页"双人关系卡片"用 |

**后端冒烟**：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-m4.ps1` 会依次覆盖：jiangjiang/mengmeng 互发、互相可见、cursor 分页、text/images 双空、text 超长、images 非法 URL、删除他人、删除自己、软删后不再出现，全部绿灯。

**小程序**：

- `pnpm --filter @momoya/mobile build:weapp` 产出 `pages/index/index`、`pages/moments/publish/index` 两个新页，冷启动入口切换到时间轴（`app.config.ts` 加了原生 `tabBar`：日常 / 我的）。
- 时间轴页顶部是「双人关系卡片」（双头像 + 昵称 + "在一起 N 天"，N 以 partner 账号创建日到今天计，未绑定 partner 显示 `—`）。下方是滚动列表，`ScrollView` + `onScrollToLower` 自动拉下一页；长按自己发的条目可删除（`showActionSheet` → `showModal` 两步确认）；右下角悬浮 `+` 跳转发布页。
- 发布页支持 `textarea`（500）+ 图片网格（最多 9 张，单张 ≤ 5MB）；选图后并行上传，每个 slot 独立显示「上传中 / 失败 / 删除」状态；发布成功后走 `momentStore.prepend()` 塞到列表顶并 `navigateBack()`，无需重拉。
- 图片统一 `resolveAssetUrl` + `useRemoteImage`：列表缩略图、大图预览都过这条通道，继承 M3 的 HTTP → `downloadFile` 兜底。
- `request.ts` 新增 `api.delete`；`momentStore` 是独立 Zustand store，登录切账号 / 登出时会 `reset()` 清空避免串数据。

## Docker 使用

本仓库提供两份 compose 文件，分别服务于**开发**和**生产部署**。

### 开发（只起 MongoDB，NestJS / Taro 在本机跑）

```powershell
pnpm docker:dev:up        # 后台启动 mongo:7 + mongo-express
pnpm docker:dev:logs      # 查看日志
pnpm docker:dev:down      # 停止但保留数据
pnpm docker:dev:reset     # 停止并清空数据卷（清库重来）
```

- MongoDB 监听 `localhost:27017`，无鉴权，开箱即可用于 `pnpm dev:server`。
- `mongo-express` 打开 `http://localhost:8081` 可视化查看数据库。
- 数据保存在具名卷 `momoya-dev_mongo-dev-data`，`docker:dev:down` 不会删除；只有 `docker:dev:reset` 会清空。

### 生产（整套 server + mongo）

1. 复制并编辑环境变量：

   ```powershell
   Copy-Item .env.docker.example .env.docker
   # 必须修改：MONGO_ROOT_PASSWORD、MOMOYA_APP_PASSWORD、JWT_ACCESS_SECRET、JWT_REFRESH_SECRET
   # access / refresh 两把 secret 必须不同，建议分别 openssl rand -hex 32
   ```

2. 构建并启动：

   ```powershell
   pnpm docker:prod:build    # 多阶段构建 momoya-server 镜像
   pnpm docker:prod:up       # 启动 mongo + server
   pnpm docker:prod:logs     # 观察日志，直到看到 "momoya server listening on ..."
   ```

3. 升级：

   ```powershell
   pnpm docker:prod:build
   pnpm docker:prod:restart  # 仅重启 server，不动 mongo
   ```

4. 下线：

   ```powershell
   pnpm docker:prod:down
   ```

- `mongo` 容器启用了鉴权：root 账号仅用于初始化与运维，应用通过最小权限账号 `momoya_app`（仅对 `momoya` 库 `readWrite`）连接。
- 应用上传目录在具名卷 `server-uploads` 中持久化，重建镜像不会丢失。
- 健康检查：容器内每 30s 调 `/api/v1/health`，连续 3 次失败自动重启。

### 常见运维命令

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.docker ps
docker compose -f docker-compose.prod.yml --env-file .env.docker exec mongo mongosh -u root -p <ROOT_PWD> --authenticationDatabase admin
docker compose -f docker-compose.prod.yml --env-file .env.docker exec server node -v
```

### 目录速览（与 Docker 相关）

```
.
├── docker-compose.yml              开发用：仅 mongo + mongo-express
├── docker-compose.prod.yml         生产用：mongo（带鉴权）+ server
├── .dockerignore                   镜像构建上下文排除清单
├── .env.docker.example             生产 env 模板（复制为 .env.docker 后改值）
├── docker/
│   └── mongo-init/
│       └── 01-create-app-user.js   首次初始化创建应用低权账号
└── apps/server/
    ├── Dockerfile                  多阶段构建：deps → builder → runtime
    └── .dockerignore
```

## 目录结构

```
.
├── apps/
│   ├── server/    # NestJS 11
│   └── mobile/    # Taro 4.2 + React 18 + Tailwind v4
├── docker/        # MongoDB 初始化脚本等
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.docker.example
├── package.json   # 根工作区
└── pnpm-workspace.yaml
```

## 常见问题

- **微信开发者工具未显示 Tailwind 样式**：关闭开发者工具里的"自动热重载"后重新编译。
- **bcrypt / weapp-tailwindcss 的构建脚本被 pnpm 忽略**：根 `package.json` 已在 `pnpm.onlyBuiltDependencies` 中显式放行，正常 `pnpm install` 即可。
- **Taro 报 `Cannot find package '@babel/plugin-proposal-decorators'`**：`apps/mobile` 已显式加入该依赖以适配 pnpm 严格解析。
- **`docker:prod:up` 起不来，日志说鉴权失败**：通常是改过 `MOMOYA_APP_PASSWORD` 但没清库——密码只在首次创建容器时写入。清 `docker volume rm momoya-prod_mongo-prod-data` 或手动 `db.updateUser` 改密。
