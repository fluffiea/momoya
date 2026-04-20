# Momoya 部署手册

> **对象**：单台 Linux 服务器（Ubuntu 22.04+ / Debian 12+ 推荐）
> **目标**：从空机到上线、稳定运行、可备份、可灾备
> **方案**：Docker Compose（mongo + api + web 三容器），web 容器内 nginx 直接终止 HTTPS；**api/web 镜像默认从 GHCR 拉取**（由 GitHub Actions 构建推送），与仓库默认分支保持一致。
>
> 若你检出的是**历史 tag**（例如旧版 v0.0.1），请以该 tag 下的 `docker-compose.prod.yml`、`DEPLOYMENT.md` 为准，步骤可能与当前主分支不同。
>
> 所有命令按顺序复制粘贴即可，遇到 `<尖括号>` 包裹的占位符替换成你自己的值。

---

## 部署架构（一眼看懂）

```
浏览器 ──HTTPS:443──► web 容器 (nginx:alpine, 80→301→443)
                       │  挂载 ./deploy/certs/  →  /etc/nginx/certs/ (TLS 证书)
                       ├─ /            静态前端 (apps/web/dist)
                       └─ /api/*  ──►  api 容器 (Node + Express + sharp)
                                        └──►  mongo 容器 (mongo:7)
                                              └─ momoya_mongo_data volume
                       api 容器：momoya_uploads volume → /app/uploads
```

- **HTTPS 在 web 容器自己处理**，不需要外部 Caddy/Cloudflare（也支持，作为可选方案见 §3.3）。
- **api / mongo 不映射宿主端口**，仅 docker 内网可达。
- **session 存 mongo**（connect-mongo），api 容器重启不会让用户掉线。

---

## 目录

- [0. 准备清单](#0-准备清单)
- [1. 服务器初始化（仅第一次）](#1-服务器初始化仅第一次)
- [2. 首次部署](#2-首次部署)
- [3. 配置 HTTPS（必做）](#3-配置-https必做)
- [4. 验收](#4-验收)
- [5. 日常运维](#5-日常运维)
- [6. 备份](#6-备份)
- [7. 灾备：把网站迁到新服务器](#7-灾备把网站迁到新服务器)
- [8. 升级与回滚](#8-升级与回滚)
- [9. 安全加固](#9-安全加固)
- [10. 故障排查 FAQ](#10-故障排查-faq)
- [附：常用命令速查](#附常用命令速查)

---

## 0. 准备清单

部署前你需要准备好：

- [ ] 一台 Linux 服务器（**至少** 1 vCPU / 1 GB RAM / 10 GB 磁盘；推荐 2 vCPU / 2 GB / 20 GB）
- [ ] 服务器的 **root SSH 访问**（首次初始化需要）
- [ ] 一个可解析到该服务器 IP 的**域名**（HTTPS 必需）
- [ ] 你电脑上有这台服务器的 **SSH 公钥**

> 没有域名也能跑，但**没有 HTTPS 登录功能直接不可用**（cookie 是 `secure: true`），见第 3 节。

---

## 1. 服务器初始化（仅第一次）

### 1.1 用 root 登录服务器

```bash
ssh root@<服务器IP>
```

### 1.2 升级系统并安装基础工具

```bash
apt update && apt upgrade -y
apt install -y curl git ufw ca-certificates gnupg
```

### 1.3 安装 Docker（官方源，自带 Compose v2）

```bash
# 添加 Docker 官方 GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 apt 源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 验证
docker --version           # 应输出 Docker version 27.x
docker compose version     # 应输出 Docker Compose version v2.x
```

### 1.4 创建运维用户 `deploy`（不要再用 root 部署）

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy           # 给 sudo 权限
usermod -aG docker deploy         # 让 deploy 可直接跑 docker

# 复制 root 的 SSH 公钥给 deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 1.5 创建项目与备份目录

```bash
mkdir -p /opt/momoya          # 项目代码
mkdir -p /var/backups/momoya  # 备份归档
chown deploy:deploy /opt/momoya /var/backups/momoya
```

### 1.6 配置防火墙

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp              # HTTP（自动跳转 HTTPS / ACME 验证留口）
ufw allow 443/tcp             # HTTPS（对外正式入口）
ufw --force enable
ufw status
```

> 注意：**不要**对外开放 4000 / 27017 —— api 与 mongo 都不映射宿主端口，从公网完全访问不到。
>
> 如果你之前为别的方案开过 8080，现在可以关掉：`ufw delete allow 8080/tcp`。
>
> ⚠️ **腾讯云 / 阿里云用户**：除了服务器内 ufw，还要在云控制台「安全组」里同步放开 22 / 80 / 443，不然从外面连不进来。

### 1.7 退出 root，之后全部用 deploy 操作

```bash
exit
ssh deploy@<服务器IP>
```

---

## 2. 首次部署

### 2.1 拉代码

```bash
cd /opt/momoya
git clone <你的仓库地址> .          # 注意末尾的 . （拉到当前目录）
```

### 2.2 生成 `.env.production`（密钥文件）

```bash
cat > .env.production <<EOF
SESSION_SECRET=$(openssl rand -hex 32)
PROFILE_SECRET_KEY=$(openssl rand -hex 32)
MOMOYA_IMAGE_PREFIX=ghcr.io/<你的 GitHub 用户名小写>
MOMOYA_IMAGE_TAG=latest
EOF

chmod 600 .env.production            # 只有 owner 可读

# 软链为 .env，让所有 docker compose 子命令都自动读取它
# 不做这步的话，每次 exec / restart / logs 都得带 --env-file，麻烦且容易忘
ln -s .env.production .env
```

`MOMOYA_IMAGE_PREFIX` 必须与 GitHub Actions 推到 GHCR 的名称一致：一般为 `ghcr.io/<GitHub 用户名全小写>`（与仓库 **Packages** 里 `momoya-api` / `momoya-web` 的命名空间一致）。`MOMOYA_IMAGE_TAG` 一般用 `latest`；需要钉死某一版时再改成该次构建的完整 commit SHA（见 §8.2）。

> ⚠️ **`PROFILE_SECRET_KEY` 一旦上线永远不要换** —— 它是数据库里加密昵称、简介的密钥（AES-256-GCM），换了那两个字段会**全部解不出来**。
>
> ⚠️ **现在立刻把 `.env.production` 的内容备份一份到你的密码管理器**（1Password / Bitwarden / Keepass）。万一服务器整盘坏了，密钥丢了等于昵称简介数据作废。
>
> `SESSION_SECRET` 可以换（换了所有用户被强制重新登录一次而已），见 §9.4。

### 2.3 准备 SSL 证书占位（先放空，§3 再填实际证书）

`docker-compose.prod.yml` 的 web 容器会把 `./deploy/certs/` 挂到 `/etc/nginx/certs/`（只读），nginx 启动时会读 `cert.crt` + `cert.key`。**首次启动前**必须有这两个文件存在，否则 nginx 会报错退出。

如果你这一步还没拿到证书，可以先生成一个**临时自签证书**让服务能起来，§3 再换成真证书：

```bash
cd /opt/momoya
mkdir -p deploy/certs

# 生成 365 天自签证书（仅用于让 nginx 起得来，浏览器会报"不安全"）
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout deploy/certs/cert.key \
  -out deploy/certs/cert.crt \
  -subj "/CN=temporary-self-signed"

chmod 600 deploy/certs/cert.key
```

如果你已经有真证书了，直接跳到 [§3.1 上传腾讯云 / 阿里云证书](#31-上传腾讯云--阿里云证书)，把 `cert.crt` / `cert.key` 放好后回来跑 §2.4。

### 2.4 启动服务

**推荐（与 §8 日常发布一致）**：api / web 镜像由 GitHub Actions 构建并推送到 GHCR，服务器只负责 **拉镜像 + 起容器**，不在生产机跑 `pnpm build`。

1. **至少推送过一次** `main`（或 `master`）分支，让 [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) 跑完，GHCR 里已有 `momoya-api` / `momoya-web` 的 `latest` 标签。
2. 在服务器执行：

```bash
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d
```

首次拉取大约 2–6 分钟（下载 mongo 官方镜像 + 两个业务镜像；体积取决于网络）。

**若暂时还没有可用的 GHCR 镜像**（例如 CI 尚未跑通），可以在服务器用 compose 里自带的 `build` 段先起一次（会占满 CPU 几分钟）：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

之后仍建议以 GHCR 为主，避免长期依赖服务器现场编译。

> 之前没做 §2.2 末尾的 `ln -s .env.production .env`？那命令要改成：
> `docker compose -f docker-compose.prod.yml --env-file .env.production pull api web` 与 `... up -d`
> 同样规则适用于本文档后面**所有** `docker compose -f docker-compose.prod.yml ...` 命令。

#### 私有 GHCR 包：先登录再 pull

若仓库或 Package 为**私有**，在服务器上对 `deploy` 用户执行一次（Token 需要 `read:packages`，经典 PAT 或 Fine-grained 均可）：

```bash
echo '<你的 GitHub Token>' | docker login ghcr.io -u <GitHub 用户名> --password-stdin
```

公开仓库且 Package 也是公开的，一般**无需登录**即可 `docker pull`。

### 2.5 检查服务状态

```bash
docker compose -f docker-compose.prod.yml ps
```

期望看到三个容器都是 `Up` 且 mongo 是 `(healthy)`：

```
NAME                STATUS                   PORTS
momoya-api-1        Up X minutes
momoya-mongo-1      Up X minutes (healthy)
momoya-web-1        Up X minutes             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### 2.6 灌入种子账号（jiangjiang / mengmeng）

> ⚠️ **密码完全由你这一步决定**——下面命令里的两个 `<你的初始密码>` 替换成你想用的明文密码（jiangjiang 和 mengmeng 可以用同一个，也可以不同）。这一步**不跑就没有任何用户**，登录会全部失败。

```bash
docker compose -f docker-compose.prod.yml exec \
  -e SEED_PASSWORD_JIANGJIANG=<你的初始密码> \
  -e SEED_PASSWORD_MENGMENG=<你的初始密码> \
  api node dist/scripts/seed.js
```

成功的输出：

```
已创建用户: jiangjiang
已创建用户: mengmeng
已写入默认日常条目
```

> 如果你看到 `用户已存在，跳过: jiangjiang`，说明这个账号已经在数据库里了，**密码不会被覆盖**。要改密码看 [§10.Q9](#q9忘了用户密码怎么重置)。

---

## 3. 配置 HTTPS（必做）

> ⚠️ **没有 HTTPS 登录直接挂**：Momoya 在生产把 session cookie 设为 `secure: true`，没 HTTPS 浏览器不发 cookie，所有登录态请求都返回 401。

Momoya 的 web 容器内 nginx 已经配好了：**80 端口自动跳 443，443 端口读 `/etc/nginx/certs/cert.crt` 和 `cert.key` 终止 TLS**。你只需要把证书放到 `deploy/certs/` 即可。

下面三个方案任选其一：

| 方案 | 适合谁 | 难度 |
|---|---|---|
| **§3.1 腾讯云 / 阿里云证书**（手动上传） | 域名在国内厂商、买了免费证书 | ⭐ |
| **§3.2 Let's Encrypt 自动签**（acme.sh） | 域名解析正常、想全自动续期 | ⭐⭐ |
| **§3.3 Cloudflare 反代** | 域名挂在 CF、不想管证书 | ⭐ |

### 3.1 上传腾讯云 / 阿里云证书

腾讯云 SSL 控制台下载证书时**选 Nginx 格式**，得到一个压缩包，里面有：

```
xxxxxx_yourdomain.com.crt        ← 证书（含证书链）
xxxxxx_yourdomain.com.key        ← 私钥
xxxxxx_yourdomain.com_bundle.crt ← 含中间证书的完整链（推荐用这个）
```

用 `scp` 把它们传到服务器（**在你本地电脑上执行**）：

```bash
# Windows PowerShell / Mac / Linux 都通用
scp xxxxxx_yourdomain.com_bundle.crt root@<服务器IP>:/opt/momoya/deploy/certs/cert.crt
scp xxxxxx_yourdomain.com.key        root@<服务器IP>:/opt/momoya/deploy/certs/cert.key
```

然后**在服务器上**：

```bash
cd /opt/momoya
ls -l deploy/certs/                  # 应该看到 cert.crt 和 cert.key
chmod 600 deploy/certs/cert.key      # 私钥权限收紧

# 让 nginx 重新读证书（不需要重建镜像，重启容器就够）
docker compose -f docker-compose.prod.yml restart web
```

验证：

```bash
curl -I https://<你的域名>           # 期望看到 HTTP/2 200
```

浏览器打开 `https://<你的域名>`，地址栏的小锁应该是绿色的。

> **证书每年到期**：腾讯云免费证书是 1 年期，到期前重复上面的步骤覆盖一次 + restart web 即可。建议在日历上加个"半年后续证书"的提醒。

### 3.2 Let's Encrypt 自动签（acme.sh + DNS API）

适合**已经能从 80 端口公网访问**或**愿意配 DNS API**的场景。这里给 DNS 验证方式（不需要服务器 80 端口可达，国内未备案也能用）：

```bash
# 1) 装 acme.sh
curl https://get.acme.sh | sh -s email=<你的邮箱>
source ~/.bashrc

# 2) 配 DNS API（以阿里云为例，腾讯云用 dns_dp，Cloudflare 用 dns_cf，详见 acme.sh wiki）
export Ali_Key="<你的 AccessKey>"
export Ali_Secret="<你的 AccessSecret>"

# 3) 申请证书
~/.acme.sh/acme.sh --issue --dns dns_ali -d <你的域名> --keylength ec-256

# 4) 安装到 Momoya 期望的位置 + 自动 reload nginx 容器
~/.acme.sh/acme.sh --install-cert -d <你的域名> --ecc \
  --fullchain-file /opt/momoya/deploy/certs/cert.crt \
  --key-file       /opt/momoya/deploy/certs/cert.key \
  --reloadcmd      "cd /opt/momoya && docker compose -f docker-compose.prod.yml restart web"

chmod 600 /opt/momoya/deploy/certs/cert.key
```

acme.sh 会自动加 cron，60 天左右续期一次并自动 reload web 容器，**之后完全不用管**。

### 3.3 Cloudflare 反代（最省事）

如果你的域名挂在 Cloudflare：

1. CF 控制台 → DNS → 把域名 A 记录指到服务器 IP，**橙色云开启**（代理）
2. CF 控制台 → SSL/TLS → 加密模式选 **Full（strict 也行）**
3. 服务器上的证书可以用 §2.3 的临时自签证书，因为浏览器看到的是 CF 给的证书；CF ↔ 源站之间也是 TLS（用临时自签即可，CF 不验证根 CA）
4. 想更安全：CF 控制台 → SSL/TLS → 源服务器 → 创建证书 → 下载后按 §3.1 上传

CF 还能附带：DDoS 防护、缓存静态资源、自动签证书，**强烈推荐**。

### 3.4 验证 HTTPS 是否真的生效

```bash
# 1) 证书有效
curl -I https://<你的域名>          # HTTP/2 200，并且不报证书错误

# 2) 80 自动跳 443
curl -I http://<你的域名>           # HTTP/1.1 301，Location: https://...

# 3) cookie 能落
# 在浏览器登录一次，F12 → Application → Cookies → momoya.sid 应该带 Secure 标记
```

任何一步不对，去看 [§10.Q1](#q1登录后立刻被退出反复无法保持登录)。

---

## 4. 验收

按这个清单挨个跑一遍：

- [ ] `https://<你的域名>` 能打开首页
- [ ] 用种子账号登录成功，**刷新页面后仍保持登录**（关键：验证 cookie 工作）
- [ ] 进「我的」→ 编辑资料 → 上传一张**长方形头像** → 保存后头像是正方形、无黑边
- [ ] 进「日常」→ 新建一篇 → 选记录时刻 → 上传 2 张图 → 长按拖动调换顺序 → 保存
- [ ] 在另一个浏览器/隐身窗用另一个账号登录 → 评论刚发的那篇 → 切回第一个浏览器，**无需刷新**应能实时看到评论（SSE 验证）
- [ ] 滑到日常列表底部，能自动加载更多（分页验证）
- [ ] `docker compose -f docker-compose.prod.yml ps` 三个容器都是 `Up`，mongo 是 `(healthy)`

任何一项不通过，去看第 10 节「故障排查 FAQ」。

---

## 5. 日常运维

> 所有命令默认在 `/opt/momoya` 目录下、用 `deploy` 用户执行。

### 5.1 看状态

```bash
docker compose -f docker-compose.prod.yml ps
```

### 5.2 看日志

```bash
# 实时跟某个服务
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f mongo

# 看最近 200 行
docker compose -f docker-compose.prod.yml logs --tail=200 api
```

### 5.3 重启某个服务

```bash
docker compose -f docker-compose.prod.yml restart api
```

### 5.4 停 / 起整个栈

```bash
docker compose -f docker-compose.prod.yml down              # 停（保留数据）
docker compose -f docker-compose.prod.yml up -d             # 起
```

### 5.5 进容器排查

```bash
# 进 api 容器
docker compose -f docker-compose.prod.yml exec -it api sh

# 直接连 mongo shell
docker compose -f docker-compose.prod.yml exec -it mongo mongosh momoya
```

### 5.6 看资源占用

```bash
docker stats --no-stream
df -h           # 磁盘
free -h         # 内存
```

---

## 6. 备份

> 备份分四类：**密钥**、**SSL 证书**、**数据库**、**用户上传文件**。四类都要备。

### 6.1 备份密钥与证书（一次性，离线保存）

`.env.production` 里的 `PROFILE_SECRET_KEY` 丢失等于昵称/简介数据全废。把整个 `.env.production` 文件内容复制到你的密码管理器（1Password / Bitwarden / Keepass），**永久保存**。

SSL 证书也建议复制一份到本地（避免迁服务器时还要重新申请）：

```bash
# 在你本地电脑上：
mkdir -p ~/backups/momoya-certs
scp deploy@<服务器IP>:/opt/momoya/deploy/certs/cert.crt ~/backups/momoya-certs/
scp deploy@<服务器IP>:/opt/momoya/deploy/certs/cert.key ~/backups/momoya-certs/
chmod 600 ~/backups/momoya-certs/cert.key
```

> 私钥要和密码管理器里的 `.env.production` 同等机密保护。
> 证书每次续期后记得覆盖更新本地副本。

### 6.2 手动备份（任何时候执行）

```bash
cd /opt/momoya
DATE=$(date +%F-%H%M)

# Mongo
docker run --rm \
  -v momoya_momoya_mongo_data:/data \
  -v /var/backups/momoya:/backup \
  alpine tar czf /backup/mongo-$DATE.tgz -C /data .

# 上传文件（头像 + 日常图片）
docker run --rm \
  -v momoya_momoya_uploads:/data \
  -v /var/backups/momoya:/backup \
  alpine tar czf /backup/uploads-$DATE.tgz -C /data .

ls -lh /var/backups/momoya/
```

### 6.3 自动每日备份（crontab）

```bash
crontab -e
```

加一行（每天凌晨 3 点备份，保留 14 天）：

```cron
0 3 * * * /opt/momoya/scripts/backup.sh >> /var/log/momoya-backup.log 2>&1
```

然后创建脚本：

```bash
mkdir -p /opt/momoya/scripts
cat > /opt/momoya/scripts/backup.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%F-%H%M)
OUT=/var/backups/momoya

docker run --rm \
  -v momoya_momoya_mongo_data:/data \
  -v $OUT:/backup \
  alpine tar czf /backup/mongo-$DATE.tgz -C /data .

docker run --rm \
  -v momoya_momoya_uploads:/data \
  -v $OUT:/backup \
  alpine tar czf /backup/uploads-$DATE.tgz -C /data .

# 删除 14 天前的备份
find $OUT -name '*.tgz' -mtime +14 -delete

echo "[$(date)] backup ok"
EOF

chmod +x /opt/momoya/scripts/backup.sh
```

### 6.4 备份拉到本地（异地容灾）

在你**本地电脑**上跑：

```bash
rsync -avz --delete deploy@<服务器IP>:/var/backups/momoya/ ~/backups/momoya/
```

或者把 `/var/backups/momoya/` 同步到对象存储（S3 / OSS / R2）。**至少保证一份备份不在原服务器上**。

---

## 7. 灾备：把网站迁到新服务器

假设原服务器挂了，但你有第 6 节的备份文件 `mongo-XXXX.tgz`、`uploads-XXXX.tgz`，以及保存在密码管理器里的 `.env.production`。

### 7.1 在新服务器上重做第 1、2.1 节

```bash
# 1) 跑完第 1 节所有命令初始化新服务器
# 2) 拉代码
cd /opt/momoya
git clone <仓库地址> .
```

### 7.2 还原 `.env.production`

把密码管理器里的内容写回 `/opt/momoya/.env.production`，记得 `chmod 600`。

### 7.3 把备份与证书传到新服务器

```bash
# 在你本地电脑上：
scp ~/backups/momoya/mongo-XXXX.tgz       deploy@<新服务器IP>:/tmp/
scp ~/backups/momoya/uploads-XXXX.tgz     deploy@<新服务器IP>:/tmp/

# SSL 证书也一起搬过去（如果还没过期就直接复用）
scp ~/backups/momoya-certs/cert.crt deploy@<新服务器IP>:/opt/momoya/deploy/certs/cert.crt
scp ~/backups/momoya-certs/cert.key deploy@<新服务器IP>:/opt/momoya/deploy/certs/cert.key
```

### 7.4 创建空 volume 并恢复数据

```bash
cd /opt/momoya

# 1) 软链 .env
ln -s .env.production .env

# 2) 设置证书私钥权限（如果上一步搬过来了）
chmod 600 deploy/certs/cert.key

# 3) 先创建 volume（不启动服务）
docker compose -f docker-compose.prod.yml create

# 4) 还原 mongo
docker run --rm \
  -v momoya_momoya_mongo_data:/data \
  -v /tmp:/backup \
  alpine sh -c "cd /data && tar xzf /backup/mongo-XXXX.tgz"

# 5) 还原 uploads
docker run --rm \
  -v momoya_momoya_uploads:/data \
  -v /tmp:/backup \
  alpine sh -c "cd /data && tar xzf /backup/uploads-XXXX.tgz"

# 6) 启动（.env.production 里需已有 MOMOYA_IMAGE_*，与线上一致）
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

### 7.5 域名切换

把 DNS A 记录指向新服务器 IP（TTL 短的话几分钟生效）。如果证书是 §7.3 一起搬过来的且未过期，**已经能 HTTPS 访问**；否则按 §3 重新申请。

---

## 8. 升级与回滚

### 8.0 换镜像时，数据还在吗？

**在。** 用户数据在两个 **Docker named volume** 里，与业务镜像、容器可写层无关：

| Volume（名称会因 compose 项目前缀略有不同） | 内容 |
|---|---|
| `momoya_mongo_data` | MongoDB 全库（账号、日常、评论、session 等） |
| `momoya_uploads` | 头像与日常图片文件 |

日常升级只会 **用新镜像替换 api/web 容器**，只要你不执行带 **`-v` / `--volumes`** 的删除命令，上述卷会**原样保留**。也不影响 `.env.production` 里的内容（除非你主动改密钥文件）。

**不要做**：`docker compose down -v`、`docker volume rm ...`、`docker system prune -a --volumes`（会删卷，数据库与上传会没）。

**与本次发布方式的关系**：从「服务器 `git pull` + `docker compose --build`」改为「拉 GHCR 预构建镜像」，**只改变镜像从哪来**，**不改变 volume 挂载方式**，因此**不是**数据迁移，也不会清空已有数据。

---

### 8.1 发布新版本（推荐：GitHub Actions → GHCR）

流程：**本地 push → CI 构建并推送镜像 → 服务器拉镜像并重启容器**。服务器上**不再**需要跑 `pnpm install` / `pnpm build`（除非应急，见 §8.5）。

整个过程大约 **1～4 分钟**（视 CI 与网络而定），服务可能有 **数秒～约 1 分钟** 的短暂不可用窗口。

#### 8.1.1 本地侧（Windows / Mac / Linux）

```powershell
cd <你的项目根目录>
git status
git add <文件1> <文件2> ...
git commit -m "fix(api): xxxxx"
git push
```

> **commit message 规范**（推荐，但不强制）：
> - `feat(scope): xxx` 新功能
> - `fix(scope): xxx`  bug 修复
> - `chore(scope): xxx` 杂项（依赖升级、配置调整）
> - `docs: xxx` 仅改文档
> - `refactor(scope): xxx` 不改行为的重构
>
> `scope` 一般是 `api` / `web` / `shared` / `deploy` 之一。

推送 `main` 或 `master` 后，打开 GitHub 仓库 → **Actions**，确认 **Publish Docker images**  workflow 已成功；再在仓库 → **Packages**（或 **ghcr.io**）里能看到 `momoya-api`、`momoya-web` 的 `latest` 与对应 commit 的 tag。

#### 8.1.2 服务器侧（SSH）

**方式 A（推荐）**：仓库里自带脚本，避免漏步骤：

```bash
cd /opt/momoya
bash deploy/server-update.sh
```

**方式 B（手动，与脚本等价）**：

```bash
cd /opt/momoya
git pull --ff-only
docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d
```

`git pull` 仍然需要：用来同步 `docker-compose.prod.yml`、`deploy/nginx.conf`、证书路径等**仓库里的配置**；**业务代码**已在镜像里，不必靠服务器上的 `apps/` 源码来运行。

##### 若本次只改了仓库里的配置（不必拉新镜像）

| 改了什么 | 操作 |
|---|---|
| 仅 `deploy/nginx.conf` / `deploy/api-entrypoint.sh` / `Dockerfile.*` | 需要 **新镜像**：等 CI 完成后照常 `pull api web` + `up -d` |
| 仅 `docker-compose.prod.yml`（不含镜像 tag 变更） | `docker compose -f docker-compose.prod.yml up -d` |
| 仅 `.env.production` | `docker compose -f docker-compose.prod.yml up -d --force-recreate api`（或按需 `--force-recreate web`） |
| 仅文档 `*.md` | 无需重启容器 |

#### 8.1.3 一次性补齐：旧服务器还没有 `MOMOYA_IMAGE_*`

若 `.env.production` 是早期版本、只有 `SESSION_SECRET` / `PROFILE_SECRET_KEY`，请**追加**两行（把前缀改成你的 GitHub 用户名小写，与 GHCR 上包名一致）：

```bash
nano /opt/momoya/.env.production
# 追加：
# MOMOYA_IMAGE_PREFIX=ghcr.io/<你的 GitHub 用户名小写>
# MOMOYA_IMAGE_TAG=latest
```

保存后执行 §8.1.2 的 `pull` + `up`。**不要改** `SESSION_SECRET` / `PROFILE_SECRET_KEY`（除非你知道后果）。

#### 8.1.4 验证（每次必做）

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=30 api
docker compose -f docker-compose.prod.yml logs --tail=30 web
```

浏览器硬刷新，抽测登录 / 发日常 / 传图。session 在 mongo 里，一般**无需重新登录**。

#### 8.1.5 万一翻车了

立刻按 [§8.2](#82-回滚到上一个版本) 回滚，不要现场改线上数据库。

---

### 8.2 回滚到上一个版本

#### 场景 A：刚发上去的镜像有问题，**想回到上一版 GHCR 镜像**

CI 为每次成功构建推送两个标签：`:latest` 与 `:<Git commit 的完整 40 位 SHA>`。在 GitHub 该次失败提交的 Actions 日志里找到**上一个成功 run** 对应的 commit，或本地 `git log` 找稳定版本的全写 SHA。

在服务器：

```bash
nano /opt/momoya/.env.production
# 设置 MOMOYA_IMAGE_TAG=<那个 40 位 SHA>，保存

docker compose -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.prod.yml up -d
```

确认恢复后，可把 `MOMOYA_IMAGE_TAG` 改回 `latest`，等修好再发一版。

**备选（不依赖 GHCR 标签）**：`git checkout <旧 commit>` 后执行 `docker compose -f docker-compose.prod.yml up -d --build`（compose 里仍保留 `build` 段，仅供应急；数据仍在 volume 里）。

#### 场景 B：你已在本地修好，**正常再发一版**

本地 `git push` → 等 CI 成功 → 服务器执行 §8.1.2（`MOMOYA_IMAGE_TAG=latest` 时即拉最新）。

#### 兜底：mongo 数据安全吗？

**安全。** 回滚只替换 **api/web 镜像与容器**，不动 named volume。唯一例外：新版本写过 **不兼容的 schema** 且已有新数据，老代码读不了——需要迁移或从备份恢复（[§6.2](#62-手动备份任何时候执行)）。

---

### 8.3 清理无用镜像

服务器上若多次 `pull`，会积累旧层，可定期：

```bash
docker image prune -af
```

若你仍在服务器上用过 `--build`，还可 `docker builder prune -af`。**不要**对生产乱用 `docker volume prune` / `docker system prune -a --volumes`。

---

### 8.4 速查卡片

```bash
# === 本地 ===
# git add <files> && git commit -m "fix(scope): xxx" && git push
# 等 GitHub Actions「Publish Docker images」变绿

# === 服务器 ===
cd /opt/momoya && bash deploy/server-update.sh
# 或：git pull --ff-only && docker compose -f docker-compose.prod.yml pull api web && docker compose -f docker-compose.prod.yml up -d
```

---

### 8.5 应急：CI 不可用、必须在服务器上现场构建

`docker-compose.prod.yml` 仍为 `api` / `web` 保留了 `build` 段。仅在应急时使用：

```bash
cd /opt/momoya
git pull
docker compose -f docker-compose.prod.yml build --no-cache api   # 或 web / 两者
docker compose -f docker-compose.prod.yml up -d
```

构建会占用大量 CPU/内存，且与 CI 环境可能略有差异；恢复后应尽快回到 **GHCR 拉镜像** 的主流程。

---

## 9. 安全加固

### 9.1 SSH 禁用密码登录（仅密钥）

```bash
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

> 操作前**先确认 deploy 用户能用密钥登录**，再禁密码，否则会把自己关在外面。

### 9.2 自动安全更新

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 9.3 fail2ban（拦截 SSH 暴力破解）

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### 9.4 密钥定期轮换

`SESSION_SECRET` **可以**定期换（换了只会让所有用户被强制重新登录一次，无数据损失）：

```bash
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -hex 32)/" /opt/momoya/.env.production
docker compose -f docker-compose.prod.yml up -d
```

`PROFILE_SECRET_KEY` **永远不要换**。

---

## 10. 故障排查 FAQ

### Q1：登录后立刻被退出，反复无法保持登录

按概率从高到低排查：

**① HTTPS 没配好（最常见）**

```bash
curl -I https://<你的域名>          # 必须是 200，且证书有效，且不是 http://
```

session cookie 在生产是 `secure: true`，**只在 HTTPS 下浏览器才会发**。如果你访问的是 `http://`，cookie 永远到不了 api。回到 §3 配 HTTPS。

**② 浏览器没收到 Set-Cookie**

F12 → Application → Cookies → 应该看到 `momoya.sid`，且 `Secure` 列有勾。如果没有，多半是：
- nginx 没把 `X-Forwarded-Proto: https` 透传给 api → 检查 `deploy/nginx.conf` 里的 `proxy_set_header X-Forwarded-Proto $scheme;` 是否还在
- 用了 Cloudflare 但 SSL 模式选了 `Flexible`（CF↔源站走 http）→ 必须改成 `Full` 或 `Full (strict)`

**③ 你最近改过 `SESSION_SECRET`**

改密钥会让所有老 cookie 签名失效。这是预期行为，所有人重新登录一次即可。

**④ cookie 已过期**

`maxAge: 14 天`，14 天没访问会自然失效，重新登录。

### Q2：`docker compose ps` 看到 `api` 一直在重启（Restarting）

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 api
```

常见原因（看日志第一行错误）：

| 报错 | 原因 / 解决 |
|---|---|
| `生产环境必须设置 SESSION_SECRET` | `.env.production` 没生成密钥 / `ln -s .env.production .env` 没做 |
| `生产环境必须设置 PROFILE_SECRET_KEY` | 同上 |
| `MongoServerSelectionError: connect ECONNREFUSED mongo:27017` | mongo 还没 healthy → 等 30 秒；或 mongo 自己挂了，看 mongo 日志 |
| `EACCES: permission denied, mkdir '/app/uploads/...'` | uploads volume 权限错 → 看 §10.Q10 |
| `gosu: not found` | 镜像构建时 apt 装 gosu 失败 → `--no-cache` 重建：`docker compose -f docker-compose.prod.yml build --no-cache api` |

### Q3：`docker compose ps` 看到 mongo 是 `(unhealthy)`

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 mongo
```

最常见原因：

- **磁盘满了**：`df -h /var/lib/docker`
- **内存不够**：mongo 7 启动需要 ≥1GB 可用内存，1GB 小机器要加 swap：

  ```bash
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ```

- **数据 volume 损坏**（极少见）：清掉 volume 重来（**会丢数据，先确保有 §6 备份**）：

  ```bash
  docker compose -f docker-compose.prod.yml down
  docker volume rm momoya_momoya_mongo_data
  # 然后按 §7.4 从备份恢复
  ```

### Q4：构建镜像时 sharp 报错

```
Error: Could not load the "sharp" module using the linux-x64 runtime
```

sharp 的预编译二进制没装好（pnpm 默认禁用 install 脚本，需要 `pnpm.onlyBuiltDependencies` 白名单）。检查仓库根目录 `package.json` 里有：

```json
"pnpm": { "onlyBuiltDependencies": ["sharp"] }
```

强制重建：

```bash
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d
```

### Q5：上传图片报 413 Request Entity Too Large

| 谁报的 | 怎么修 |
|---|---|
| 内层 nginx（web 容器） | `deploy/nginx.conf` 已设 `client_max_body_size 12m`，应该够 |
| 前面套了 Cloudflare | CF 免费版默认 100MB 限制，够用；但 CF Pro/Free 都不能改这个值 |
| 前面套了别的反代（自建 Caddy / Nginx） | 在那一层也放开到 12M |

### Q6：80 / 443 端口被宿主机其他服务占用

```bash
sudo ss -tlnp | grep -E ':(80|443) '
```

通常是系统自带 nginx / apache：

```bash
sudo systemctl disable --now nginx apache2 2>/dev/null
docker compose -f docker-compose.prod.yml up -d
```

### Q7：磁盘快满了

```bash
df -h
docker system df             # 看 docker 各类资源占用
docker image prune -af       # 清旧镜像（每次部署会留下旧镜像）
docker builder prune -af     # 清构建缓存
```

`mongo` 数据卷在 `/var/lib/docker/volumes/momoya_momoya_mongo_data/_data`；`uploads` 在 `momoya_momoya_uploads/_data`。Momoya 这种使用规模数据增长极慢，几年内不用担心。

### Q8：想看 mongo 集合数据

```bash
docker compose -f docker-compose.prod.yml exec -it mongo mongosh momoya
```

进去之后：

```js
show collections
db.users.find({}, { passwordHash: 0 }).pretty()
db.dailyentries.find().sort({ at: -1 }).limit(5).pretty()
db.dailycomments.countDocuments()
db.sessions.countDocuments()           // connect-mongo 存在 sessions 集合
```

### Q9：忘了用户密码，怎么重置？

seed 脚本对已存在用户**只会跳过、不覆盖密码**。下面给两种重置方式，**任选其一**。

#### 方式 A：删掉用户重新 seed（推荐，最简单）

```bash
# 1) 删用户（不会丢他写的日常/评论，那些表只存 username 字符串）
docker compose -f docker-compose.prod.yml exec mongo mongosh momoya --eval \
  'db.users.deleteOne({ username: "jiangjiang" })'

# 2) 重 seed（密码就是下面填的）
docker compose -f docker-compose.prod.yml exec \
  -e SEED_PASSWORD_JIANGJIANG=<新密码> \
  -e SEED_PASSWORD_MENGMENG=<占位即可，已存在的会跳过> \
  api node dist/scripts/seed.js
```

> 删完后 §6 备份还是要做的，万一删错人。

#### 方式 B：直接改密码 hash（保留所有用户数据）

分两步走，**比一行嵌套引号靠谱**：

```bash
# 第 1 步：在 api 容器里生成 bcrypt hash
docker compose -f docker-compose.prod.yml exec api node -e \
  'import("bcryptjs").then(b => b.default.hash(process.argv[1], 12)).then(console.log)' \
  "<新密码>"

# 输出形如：$2b$12$abcdefg......（这就是 hash）

# 第 2 步：把 hash 写进数据库（替换下面 <hash> 为上面的输出，整体引号要保留）
docker compose -f docker-compose.prod.yml exec mongo mongosh momoya --eval \
  'db.users.updateOne({ username: "jiangjiang" }, { $set: { passwordHash: "<hash>" } })'
```

成功的输出是 `acknowledged: true, matchedCount: 1, modifiedCount: 1`。

#### 方式 C：让用户在前端"修改密码"

如果用户能登进去，最简单的是直接在「我的」页面改密码（前端已支持）。

### Q10：上传图片报 500、api 日志里有 `EACCES: permission denied` 在 `/app/uploads/...`

uploads named volume 权限错了。修复：

```bash
# 临时（一次性）：
docker compose -f docker-compose.prod.yml exec --user root api \
  chown -R nodejs:nodejs /app/uploads

# 长期（推荐已经在镜像里了）：
# 仓库的 deploy/api-entrypoint.sh + Dockerfile.api 已配置启动前自动 chown，
# 如果没生效，重建一下 api 镜像：
docker compose -f docker-compose.prod.yml up -d --build api
```

### Q11：`git pull` 报 `Permission denied` 或 `cannot open .git/FETCH_HEAD`

`.git` 目录的 owner 与当前 SSH 用户不一致。修：

```bash
sudo chown -R $(whoami):$(whoami) /opt/momoya
```

如果 remote 是 `git@github.com:...`（SSH 协议）但当前用户没配 SSH key，可以改成 https 协议（国内可加 ghfast.top 加速）：

```bash
cd /opt/momoya
git remote set-url origin https://ghfast.top/https://github.com/<你的用户名>/<仓库>.git
git pull
```

### Q12：头像 / 日常图片上传看起来"失败"——API 返回 200 但前端加载图片 404

**现象**：

- API 日志里 `POST /api/profile/avatar 200` / `POST /api/daily/entries/.../images 200`
- 服务器上 `/app/uploads/avatars/xxx.webp` 文件也存在
- 但浏览器里头像显示为裂图，F12 Network 里 `xxx.webp` / `xxx.png` 请求是 404 红 ×
- `curl -I https://<域名>/api/static/avatars/xxx.webp` 也返回 404

**原因**：`deploy/nginx.conf` 里 `location /api/` 的匹配优先级**低于**上面的正则 `location ~* \.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?)$`，所以 `/api/static/avatars/xxx.webp` 这种动态文件被当成了纯静态资源去 `/usr/share/nginx/html` 里找，找不到就 404。

**修法**：把 `location /api/` 改成 `location ^~ /api/`（`^~` 的意思是"匹配此前缀就不要再看正则"）。**仓库里最新的 `deploy/nginx.conf` 已经带这个修复**，确认你的版本：

```bash
grep -n "^~ /api/" /opt/momoya/deploy/nginx.conf
```

如果没有，`git pull` 后等 CI 成功，再执行 `docker compose -f docker-compose.prod.yml pull web && docker compose -f docker-compose.prod.yml up -d web`（或 `bash deploy/server-update.sh`）。

### Q13：构建很慢 / `pnpm install` 卡在 fetching

**日常发布**已在 GitHub Actions 里构建镜像，服务器**不再**跑 `pnpm install`。若你在 **§8.5 应急** 于服务器现场 `docker compose build`，国内机子拉 npm 可能很慢，可临时在 Dockerfile 的 builder 阶段换淘宝源（见仓库内 `Dockerfile.api` / `Dockerfile.web` 注释自行加一行 `pnpm config set registry …`），但可能影响 lockfile 可复现性，**只在应急时用**。

---

## 附：常用命令速查

> 前提：已按 §2.2 末尾做过 `ln -s .env.production .env`，否则下面所有命令都要加 `--env-file .env.production`。

| 操作 | 命令 |
|------|------|
| 启动 | `docker compose -f docker-compose.prod.yml up -d` |
| 停止 | `docker compose -f docker-compose.prod.yml down` |
| 状态 | `docker compose -f docker-compose.prod.yml ps` |
| 日志（实时） | `docker compose -f docker-compose.prod.yml logs -f api` |
| 日志（最近 N 行） | `docker compose -f docker-compose.prod.yml logs --tail=100 api` |
| 重启某服务 | `docker compose -f docker-compose.prod.yml restart api` |
| 强制重建容器（环境变量更新后） | `docker compose -f docker-compose.prod.yml up -d --force-recreate api` |
| 拉新配置 + 拉镜像发版 | `bash deploy/server-update.sh` 或 `git pull --ff-only && docker compose -f docker-compose.prod.yml pull api web && docker compose -f docker-compose.prod.yml up -d` |
| 进 api 容器 shell | `docker compose -f docker-compose.prod.yml exec -it api sh` |
| 进 mongo shell | `docker compose -f docker-compose.prod.yml exec -it mongo mongosh momoya` |
| 上传 SSL 证书后 reload | `docker compose -f docker-compose.prod.yml restart web` |
| 手动备份 | `bash /opt/momoya/scripts/backup.sh` |
| 清旧镜像 | `docker image prune -af && docker builder prune -af` |
| 看资源占用 | `docker stats --no-stream` |

---

**这份文档没覆盖的问题、或命令跑出来不符合预期，把日志贴出来一起看：**

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 api
docker compose -f docker-compose.prod.yml logs --tail=80 web
df -h && free -h
```
