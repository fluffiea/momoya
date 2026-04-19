# SSL 证书目录

web 容器（nginx）启动时会读这两个文件来终止 HTTPS：

| 文件 | 内容 |
|---|---|
| `cert.crt` | 服务器证书（**含完整证书链**，腾讯云 / 阿里云 Nginx 格式的 `*_bundle.crt`） |
| `cert.key` | 私钥 |

> 文件名固定是 `cert.crt` 和 `cert.key`，由 `deploy/nginx.conf` 里的 `ssl_certificate` / `ssl_certificate_key` 指向。

## 怎么放

详见 [`DEPLOYMENT.md` §3 配置 HTTPS](../../DEPLOYMENT.md#3-配置-https必做)。简版：

```bash
# 在你本地电脑上：
scp xxx_yourdomain.com_bundle.crt root@<服务器>:/opt/momoya/deploy/certs/cert.crt
scp xxx_yourdomain.com.key        root@<服务器>:/opt/momoya/deploy/certs/cert.key

# 服务器上：
chmod 600 /opt/momoya/deploy/certs/cert.key
docker compose -f docker-compose.prod.yml restart web
```

## 重要

- ⚠️ **不要把真证书提交到 git**。`.gitignore` 已经把 `deploy/certs/*` 排除（除了 `.gitkeep` 和本 README）。
- ⚠️ **私钥权限收紧到 `chmod 600`**。
- 首次启动前 nginx 必须能找到这两个文件，否则容器会报错退出。如果还没拿到正式证书，可以先生成一个临时自签证书让服务起来（[`DEPLOYMENT.md` §2.3](../../DEPLOYMENT.md#23-准备-ssl-证书占位先放空3-再填实际证书)）。
- 腾讯云免费证书 1 年期，到期前重新下载、覆盖、`restart web` 即可。建议在日历加提醒。
