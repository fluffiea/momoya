#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# API 容器启动前的修复脚本
#
# 问题：docker named volume 第一次挂到 /app/uploads 时归 root 所有，
#       而 api 进程是 nodejs(1001)，会写入失败（EACCES）。
# 解决：以 root 启动 → 修正 uploads 目录所有权 → 用 gosu 降权运行真正的进程。
# ─────────────────────────────────────────────────────────────────────────────
set -e

mkdir -p /app/uploads/avatars /app/uploads/daily-images
chown -R nodejs:nodejs /app/uploads

# 降权到 nodejs 后再 exec，PID 1 信号能正常传递（docker stop 优雅退出）
exec gosu nodejs "$@"
