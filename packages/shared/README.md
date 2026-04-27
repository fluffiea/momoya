# @momoya/shared

前后端共享的领域类型、常量、错误码。**只能放纯 TS 类型与常量**，不要引入任何运行时依赖（如 class-validator / @nestjs/* / @tarojs/*）——否则会把 Nest 依赖链拉进小程序包体，或者反过来把浏览器 API 拉进后端。

## 目录

```
src/
  index.ts       # barrel，统一 re-export
  errors.ts      # ErrorKey / ErrorCode / httpStatusToErrorKey
  constants.ts   # 领域常量（文本上限、图片上限、上传大小等）
  auth.ts        # TokenPair / LoginResult / LoginInput / ChangePassword* 等
  user.ts        # MeDto / PartnerBrief / UpdateMeInput
  moment.ts      # MomentAuthor / Moment / MomentListResult / CreateMomentInput
  upload.ts      # UploadImageResult / AllowedImageMime
  api.ts         # ApiResponse<T> / ApiErrorResponse 统一响应包装
```

## 消费方式

两端都通过 `workspace:*` 依赖引入：

```jsonc
// apps/server/package.json, apps/mobile/package.json
{
  "dependencies": {
    "@momoya/shared": "workspace:*"
  }
}
```

该包会产出 **CJS + ESM 双产物**：

```
dist/
  cjs/              # require('@momoya/shared')，给 Nest 后端用
    index.js
    index.d.ts
  esm/              # import { ... } from '@momoya/shared'，给 Taro/Vite 用
    package.json    # { "type": "module" }，让 Node/Vite 把目录识别成 ESM
    index.js
```

`package.json` 声明了条件导出：

```jsonc
"exports": {
  ".": {
    "types": "./dist/cjs/index.d.ts",
    "import": "./dist/esm/index.js",
    "require": "./dist/cjs/index.js"
  }
}
```

消费前需要先构建：`pnpm --filter @momoya/shared build`。根目录的 `pnpm install` 会通过 `postinstall` 自动触发；`pnpm dev` 通过 `concurrently` 同时起 `tsc --watch`、Taro、Nest 三条流水线，保证 shared 改动实时生效。

## 与后端 DTO 的协作

后端的 `*.dto.ts` 会保留 class 定义（因为需要 `class-validator` / `@nestjs/swagger` 的装饰器），但会 `implements` shared 里的同名接口。这样一旦前端 / shared 改了字段，后端 class 编译立刻爆红，从而避免两端不一致。
