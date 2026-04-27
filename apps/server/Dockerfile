# syntax=docker/dockerfile:1.7
# 多阶段构建：
#   base    -> 复用的 Node + pnpm 基础镜像
#   deps    -> 依据 workspace 清单安装 server 所需依赖
#   builder -> 编译 TS 并 pnpm deploy 出一份只含 prod 依赖的 isolated 目录
#   runtime -> 体积精简、非 root 运行的最终镜像
ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:${PATH}
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
# bcrypt 在 alpine/musl 下可能需要从源码编译，预装 build 工具避免 prebuild 缺失
RUN apk add --no-cache python3 make g++ libc6-compat
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared ./packages/shared
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @momoya/server...

FROM deps AS builder
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
RUN pnpm --filter @momoya/shared build
RUN pnpm --filter @momoya/server build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @momoya/server deploy --prod --legacy /deploy

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads
WORKDIR /app

RUN addgroup -S momoya && adduser -S -G momoya momoya \
 && mkdir -p /app/uploads \
 && chown -R momoya:momoya /app

COPY --from=builder --chown=momoya:momoya /deploy/node_modules ./node_modules
COPY --from=builder --chown=momoya:momoya /workspace/apps/server/dist ./dist
COPY --from=builder --chown=momoya:momoya /workspace/apps/server/package.json ./package.json

USER momoya

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
