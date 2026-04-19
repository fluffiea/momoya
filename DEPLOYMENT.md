# Momoya 部署手册

> **对象**：单台 Linux 服务器（Ubuntu 22.04+ / Debian 12+ 推荐）
> **目标**：从空机到上线、稳定运行、可备份、可灾备
> **方案**：Docker Compose（mongo + api + web 三容器），web 容器内 nginx 直接终止 HTTPS
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
EOF

chmod 600 .env.production            # 只有 owner 可读

# 软链为 .env，让所有 docker compose 子命令都自动读取它
# 不做这步的话，每次 exec / restart / logs 都得带 --env-file，麻烦且容易忘
ln -s .env.production .env
```

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

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

首次构建大约 3–8 分钟（下载 mongo + node + nginx 镜像，构建 api/web 两个镜像）。

> 之前没做 §2.2 末尾的 `ln -s .env.production .env`？那命令要改成：
> `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
> 同样规则适用于本文档后面**所有** `docker compose -f docker-compose.prod.yml ...` 命令。

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

# 6) 启动
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

### 7.5 域名切换

把 DNS A 记录指向新服务器 IP（TTL 短的话几分钟生效）。如果证书是 §7.3 一起搬过来的且未过期，**已经能 HTTPS 访问**；否则按 §3 重新申请。

---

## 8. 升级与回滚

### 8.1 发布新版本（标准流程）

每次本地改完代码，从提交到服务器生效的**完整流程**如下。整个过程大约 **2～5 分钟**，期间服务有 **几秒钟到 1 分钟** 的不可用窗口。

#### 8.1.1 本地侧（Windows / 任何开发机）

```powershell
# 1) 进项目根目录
cd D:\dev\momoya

# 2) 看一眼改了哪些文件，确认没把临时垃圾带上
git status

# 3) 选择性 add（推荐显式列出要提交的文件，别用 git add .）
git add <文件1> <文件2> ...

# 4) 写清楚的 commit message
git commit -m "fix(api): xxxxx"   # 见下方 commit message 规范

# 5) 推到远端
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

#### 8.1.2 服务器侧（SSH 登录服务器）

```bash
# 1) 进项目目录
cd /opt/momoya

# 2) 拉最新代码
git pull

# 3) 看本次改了哪些文件，决定要不要重建（见下方"判断重建范围"）
git log --stat -1
```

##### 判断重建范围（很重要，能省时间）

按本次改动的文件，决定执行下面**哪一条**命令：

| 改了什么 | 执行命令 | 耗时 |
|---|---|---|
| 仅前端代码（`apps/web/**`） | `docker compose -f docker-compose.prod.yml up -d --build web` | ~1 分钟 |
| 仅后端代码（`apps/api/**`、`packages/shared/**`） | `docker compose -f docker-compose.prod.yml up -d --build api` | ~1～2 分钟 |
| 前后端都改了 | `docker compose -f docker-compose.prod.yml up -d --build api web` | ~2～3 分钟 |
| 改了 `Dockerfile.api` / `Dockerfile.web` / `package.json` / `pnpm-lock.yaml` | 同上对应服务，但**不要带缓存**：加 `--no-cache` 重新构建 | ~3～5 分钟 |
| 改了 `nginx.conf` / `deploy/api-entrypoint.sh` | `docker compose -f docker-compose.prod.yml up -d --build <对应服务>` | ~1 分钟 |
| 改了 `docker-compose.prod.yml` | `docker compose -f docker-compose.prod.yml up -d` | ~10 秒 |
| 仅改了 `.env.production` | `docker compose -f docker-compose.prod.yml up -d --force-recreate api`（容器需要重读环境变量） | ~10 秒 |
| 仅改了文档（`*.md`） | **不用做任何事**，直接结束 | 0 |

> **不确定就全量重建**（最稳妥，多花 1 分钟而已）：
> ```bash
> docker compose -f docker-compose.prod.yml up -d --build
> ```

#### 8.1.3 验证（每次必做）

```bash
# 1) 看服务是不是都起来了
docker compose -f docker-compose.prod.yml ps

# 2) 看 api 日志，确认没报错
docker compose -f docker-compose.prod.yml logs --tail=30 api

# 3) 看 web 日志（仅在重建了 web 的时候）
docker compose -f docker-compose.prod.yml logs --tail=30 web
```

期望看到：
- `ps` 输出里 `api` / `web` / `mongo` 都是 `Up`
- `api` 日志末尾有 `API listening on http://127.0.0.1:4000`，**没有** `Error` / `EACCES` / `ECONNREFUSED`

然后**浏览器**：

1. 打开 `https://<你的域名>`，硬刷新（`Ctrl+Shift+R`）
2. **不用重新登录**——session 存在 mongo 里（`connect-mongo`），api 容器重启 / 重建不会让用户掉线
3. 跑一下 [§4 验收清单](#4-验收) 里的关键路径：发条日常 / 上传头像 / 写条评论

> 万一登录被踢了，要么是你**改了** `SESSION_SECRET`（cookie 签名失效），要么是 cookie 自然过期（14 天不访问）。这不属于发布异常，重新登录即可。

#### 8.1.4 万一翻车了

立刻回滚（见 [§8.2](#82-回滚到上一个版本)），不要现场调试 —— 先把服务恢复，再回头慢慢查。

---

### 8.2 回滚到上一个版本

#### 场景 A：刚 push 上去的 commit 有问题，**想撤掉这次发布**

```bash
cd /opt/momoya

# 1) 看最近 5 个 commit，找上一个稳定的 hash
git log --oneline -5

# 2) 临时切到老版本（detached HEAD，不动 dev 分支）
git checkout <上一个稳定的 commit-hash>

# 3) 用老代码重建
docker compose -f docker-compose.prod.yml up -d --build
```

服务恢复后，回到本地修 bug、再走一次 §8.1，最后服务器执行：

```bash
cd /opt/momoya
git checkout dev      # 切回正常分支
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

#### 场景 B：你已经在本地修好了，**想直接用新提交覆盖**

```bash
# 本地：照常 git commit / git push
# 服务器：
cd /opt/momoya
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

#### 兜底：mongo 数据安全吗？

**安全。** 回滚只动镜像，不动 named volume（`momoya_mongo_data` / `momoya_uploads`）。
唯一例外：如果你的代码里改了 mongo 的 schema 并写过新数据，回滚后老代码可能读不出来——这种情况要么补 migration，要么在出问题前先备份（[§6.2](#62-手动备份任何时候执行)）。

---

### 8.3 清理无用镜像

每次重建会留下旧镜像，**几次之后会吃掉好几 G 磁盘**。建议每次部署完顺手清一下：

```bash
docker image prune -af              # 删除所有无标签 / 无容器引用的镜像
docker builder prune -af            # 删除构建缓存（下次 build 会变慢但更干净）
```

> ⚠️ **不要**跑 `docker volume prune` 不加确认 —— named volume 安全，但万一手滑就麻烦了。
> ⚠️ **不要**跑 `docker system prune -a --volumes` —— 这会删 volume，**数据库直接没了**。

---

### 8.4 速查卡片

把这段贴在显眼位置，下次更新照抄：

```bash
# === 本地（PowerShell） ===
cd D:\dev\momoya
git status
git add <files...>
git commit -m "fix(scope): xxx"
git push

# === 服务器（SSH） ===
cd /opt/momoya
git pull
git log --stat -1                                                  # 看改了什么
docker compose -f docker-compose.prod.yml up -d --build api web    # 全量重建（最稳）
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=30 api
# 浏览器：硬刷新即可（无需重新登录，session 在 mongo），抽测一个核心功能
```

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

如果没有，`git pull` 后 `docker compose -f docker-compose.prod.yml up -d --build web`。

### Q13：构建很慢 / `pnpm install` 卡在 fetching

国内服务器拉 npm registry 慢。可以临时换淘宝镜像：

```bash
# 进 api 容器里看是 pnpm 还是 corepack 慢，针对性换源
# 或在 Dockerfile.api 的 builder 阶段加：
# RUN pnpm config set registry https://registry.npmmirror.com
```

但镜像源切换可能影响 `pnpm-lock.yaml` 的可复现性，**只在卡到不能忍时再用**。

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
| 拉新代码 + 全量发版 | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
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
