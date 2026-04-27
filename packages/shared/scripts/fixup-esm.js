#!/usr/bin/env node
/**
 * 在 dist/esm 下写一个 package.json：`{ "type": "module" }`，
 * 让 Node / Vite 把这个目录下的 .js 识别成真正的 ES Module。
 * 这样 shared 可以同时被：
 *   - CommonJS Nest 后端通过 `require('@momoya/shared')` 读 dist/cjs
 *   - Taro/Vite rollup 通过 `import` 读 dist/esm
 */
const fs = require('node:fs');
const path = require('node:path');

const esmDir = path.resolve(__dirname, '..', 'dist', 'esm');
fs.mkdirSync(esmDir, { recursive: true });
fs.writeFileSync(
  path.join(esmDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
  'utf8',
);
console.log('[shared] wrote dist/esm/package.json');
