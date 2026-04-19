# Momoya 部署手册

> 对象：单台 Linux 服务器（Ubuntu 22.04+ / Debian 12+ 推荐）
> 目标：从空机到上线、稳定运行、可备份、可灾备
>
> 全程 Docker 部署，**所有命令按顺序复制粘贴即可**，遇到 `<尖括号>` 包裹的占位符替换成你自己的值。

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
ufw allow 80/tcp              # HTTP（ACME 证书申请用）
ufw allow 443/tcp             # HTTPS（对外正式入口）
ufw --force enable
ufw status
```

> 注意：**不要**对外开放 8080 / 4000 / 27017。8080 只在本机被 Caddy 反代调用，4000 和 27017 完全不映射出宿主机。

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
WEB_PORT=8080
EOF

chmod 600 .env.production            # 只有 owner 可读

# 软链为 .env，让所有 docker compose 子命令都自动读取它
# 不做这步的话，每次 exec / restart / logs 都得带 --env-file，麻烦且容易忘
ln -s .env.production .env
```

> ⚠️ **`PROFILE_SECRET_KEY` 一旦上线永远不要换**——它是数据库里加密昵称、简介的密钥，换了那两个字段会全部解不出来。
>
> ⚠️ **现在立刻把 `.env.production` 的内容备份一份到你的密码管理器**（1Password / Bitwarden 等）。万一服务器整盘坏了，密钥丢了等于上传图片以外的数据全部作废。

### 2.3 启动服务

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

首次构建大约 3–8 分钟（要下载 mongo + node + nginx 镜像，并构建 api/web 两个镜像）。

> 之前没做 §2.2 末尾的 `ln -s .env.production .env`？那这条命令要改成：
> `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
> 同样规则适用于本文档后面**所有** `docker compose -f docker-compose.prod.yml ...` 命令。

### 2.4 检查服务状态

```bash
docker compose -f docker-compose.prod.yml ps
```

期望看到三个容器都是 `Up` 且 mongo 是 `(healthy)`：

```
NAME                STATUS                   PORTS
momoya-api-1        Up X minutes
momoya-mongo-1      Up X minutes (healthy)
momoya-web-1        Up X minutes             0.0.0.0:8080->80/tcp
```

### 2.5 灌入种子账号（jiangjiang / mengmeng）

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

> 如果你看到 `用户已存在，跳过: jiangjiang`，说明这个账号已经在数据库里了，**密码不会被覆盖**。要改密码请用第 10.9 节的方法。

---

## 3. 配置 HTTPS（必做）

> Momoya 的会话 cookie 是 `secure: true`，**没有 HTTPS 浏览器不会发送 cookie，登录会直接挂**。

下面以 **Caddy** 为例，3 行配置自动管 Let's Encrypt 证书。如果你用 Cloudflare 或 Nginx 自有证书，跳到本节末尾。

### 3.1 在服务器上装 Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy
```

### 3.2 写 Caddy 配置

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
<你的域名> {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8080
}
EOF

sudo systemctl reload caddy
```

把 `<你的域名>` 替换成真实域名（已 A 记录到本服务器 IP）。Caddy 会自动从 Let's Encrypt 申请证书，几秒钟内就可以 HTTPS 访问。

### 3.3 验证

```bash
curl -I https://<你的域名>
# 应该看到 HTTP/2 200，且 Server: Caddy
```

### 3.4 替代方案：Cloudflare

把域名挂 Cloudflare → DNS A 记录指到服务器 IP → SSL/TLS 模式选 **Full**。源站只要 8080 端口对 Cloudflare 开放（`ufw allow from <CF IP> to any port 8080`）即可，浏览器与 CF 之间 HTTPS 由 CF 提供。

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

> 备份分三类：**密钥**、**数据库**、**用户上传文件**。三类都要备。

### 6.1 备份密钥（一次性，离线保存）

`.env.production` 里的 `PROFILE_SECRET_KEY` 丢失等于昵称/简介数据全废。把整个 `.env.production` 文件内容复制到你的密码管理器（1Password / Bitwarden / Keepass），**永久保存**。

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

### 7.3 把备份传到新服务器

```bash
# 在你本地电脑上：
scp ~/backups/momoya/mongo-XXXX.tgz   deploy@<新服务器IP>:/tmp/
scp ~/backups/momoya/uploads-XXXX.tgz deploy@<新服务器IP>:/tmp/
```

### 7.4 创建空 volume 并恢复数据

```bash
cd /opt/momoya

# 先创建 volume（不启动服务）
docker compose -f docker-compose.prod.yml create

# 还原 mongo
docker run --rm \
  -v momoya_momoya_mongo_data:/data \
  -v /tmp:/backup \
  alpine sh -c "cd /data && tar xzf /backup/mongo-XXXX.tgz"

# 还原 uploads
docker run --rm \
  -v momoya_momoya_uploads:/data \
  -v /tmp:/backup \
  alpine sh -c "cd /data && tar xzf /backup/uploads-XXXX.tgz"

# 软链 .env（同 §2.2 末尾），并启动
ln -s .env.production .env
docker compose -f docker-compose.prod.yml up -d --build
```

### 7.5 域名切换

把 DNS A 记录指向新服务器 IP，重新跑第 3 节配置 HTTPS。

---

## 8. 升级与回滚

### 8.1 发布新版本

```bash
cd /opt/momoya
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

旧版本镜像会被自动停掉、新镜像启动，**几秒钟服务不可用**（如果在意零停机，需要上更复杂的蓝绿/滚动方案，目前规模无必要）。

### 8.2 回滚到上一个版本

```bash
cd /opt/momoya
git log --oneline -5                  # 找到上一个稳定 commit 的 hash
git checkout <commit-hash>
docker compose -f docker-compose.prod.yml up -d --build
```

回滚不会丢数据库数据（mongo volume 与代码版本无关）。

### 8.3 清理无用镜像

每次重建会留下旧镜像，定期清理释放磁盘：

```bash
docker image prune -af
docker volume prune -f       # ⚠️ 不会删 named volume，但仍建议先确认
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

**99% 是 HTTPS 没配好**。检查：

```bash
curl -I https://<域名>      # 必须是 200，且证书有效
```

如果是 `http://`（没 S），会话 cookie 是 `secure: true`，浏览器根本不会发 cookie。回到第 3 节配 HTTPS。

### Q2：`docker compose ps` 看到 `api` 一直在重启（Restarting）

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 api
```

常见原因：
- `生产环境必须设置 SESSION_SECRET` → `.env.production` 没生成密钥
- `生产环境必须设置 PROFILE_SECRET_KEY` → 同上
- mongo 还没起来 → 等几秒会自愈，否则看 mongo 日志

### Q3：`docker compose ps` 看到 mongo 是 `(unhealthy)`

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 mongo
```

最常见是磁盘满了：

```bash
df -h /var/lib/docker
```

或权限问题：清掉 volume 重来（**会丢数据**，请确保有备份）：

```bash
docker compose -f docker-compose.prod.yml down
docker volume rm momoya_momoya_mongo_data
# 然后按第 7.4 节从备份恢复
```

### Q4：构建镜像时 sharp 报错

```
Error: Could not load the "sharp" module using the linux-x64 runtime
```

意味着 sharp 的预编译二进制没装好。强制重建：

```bash
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d
```

### Q5：上传图片报 413 Request Entity Too Large

`deploy/nginx.conf` 里 `client_max_body_size` 已经放到 12M。如果你前面套了 Caddy/Cloudflare，要在那一层也放开。

Caddyfile 加：
```
request_body {
    max_size 12MB
}
```

### Q6：80 / 443 端口被占用

```bash
sudo ss -tlnp | grep -E ':(80|443) '
```

通常是系统自带 nginx/apache 占了：

```bash
sudo systemctl disable --now nginx apache2 2>/dev/null
```

### Q7：磁盘快满了

```bash
df -h
docker system df             # 看 docker 占用
docker image prune -af       # 清旧镜像
docker builder prune -af     # 清构建缓存
```

mongo 数据增长快的话，看看 `/var/lib/docker/volumes/momoya_momoya_mongo_data/_data` 多大；正常情况下 momoya 这种规模的数据增长非常慢。

### Q8：想看某个 mongo 集合的数据

```bash
docker compose -f docker-compose.prod.yml exec -it mongo mongosh momoya
# 然后：
> show collections
> db.dailyentries.find().limit(5).pretty()
> db.users.find({}, { passwordHash: 0 }).pretty()
```

### Q9：忘了用户密码，怎么重置？

seed 脚本对已存在的用户**只会跳过、不会覆盖密码**。重置走两步：先删掉用户，再重跑 seed。

```bash
# 1) 进 mongo 删掉这个用户
docker compose -f docker-compose.prod.yml exec -it mongo mongosh momoya --eval '
  db.users.deleteOne({ username: "jiangjiang" })
'

# 2) 重新 seed（密码改成你想要的新密码）
docker compose -f docker-compose.prod.yml exec \
  -e SEED_PASSWORD_JIANGJIANG=<新密码> \
  -e SEED_PASSWORD_MENGMENG=<新密码> \
  api node dist/scripts/seed.js
```

> 删用户**不会丢**他写的日常和评论（那些表里只存 username 字符串，不是外键）。

如果想直接改密码而不删用户，可以在容器里跑：

```bash
docker compose -f docker-compose.prod.yml exec -it api sh -c '
  node -e "
    import(\"bcryptjs\").then(async (b) => {
      const hash = await b.default.hash(process.argv[1], 12);
      console.log(hash);
    });
  " <新密码>
'
# 把上面输出的 hash 复制下来，然后：
docker compose -f docker-compose.prod.yml exec -it mongo mongosh momoya --eval '
  db.users.updateOne(
    { username: "jiangjiang" },
    { $set: { passwordHash: "<刚才复制的 hash>" } }
  )
'
```

---

## 附：常用命令速查

> 前提：已按 §2.2 末尾做过 `ln -s .env.production .env`，否则下面所有命令都要加 `--env-file .env.production`。

| 操作 | 命令 |
|------|------|
| 启动 | `docker compose -f docker-compose.prod.yml up -d` |
| 停止 | `docker compose -f docker-compose.prod.yml down` |
| 状态 | `docker compose -f docker-compose.prod.yml ps` |
| 日志 | `docker compose -f docker-compose.prod.yml logs -f api` |
| 重启 api | `docker compose -f docker-compose.prod.yml restart api` |
| 发新版本 | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| 进容器 | `docker compose -f docker-compose.prod.yml exec -it api sh` |
| 手动备份 | `bash /opt/momoya/scripts/backup.sh` |

---

**任何这份文档没覆盖的问题、或命令跑出来不符合预期的输出，把日志贴出来一起看。**
