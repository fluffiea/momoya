import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const IMAGE_NAME = 'momoya-server';
const DEFAULT_OUTPUT_DIR = 'artifacts';

function pad(value) {
  return String(value).padStart(2, '0');
}

function createTag(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('.');
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    platform: undefined,
    tag: createTag(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--platform') {
      options.platform = argv[++i];
    } else if (arg === '--out-dir') {
      options.outputDir = argv[++i];
    } else if (arg === '--tag') {
      options.tag = argv[++i];
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }

  return options;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function printHelp() {
  console.log(`用法：
  pnpm docker:prod:pack
  pnpm docker:prod:pack -- --platform linux/amd64
  pnpm docker:prod:pack -- --out-dir artifacts --tag 2026.04.27.22.00.00

参数：
  --platform   传给 docker buildx build，例如 linux/amd64
  --out-dir    tar 输出目录，默认 artifacts
  --tag        覆盖自动生成的镜像 tag
`);
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const tag = options.tag;
const image = `${IMAGE_NAME}:${tag}`;
const outputDir = resolve(process.cwd(), options.outputDir);
const tarName = `${IMAGE_NAME}-${tag}.tar`;
const tarPath = resolve(outputDir, tarName);

mkdirSync(outputDir, { recursive: true });

if (options.platform) {
  run('docker', [
    'buildx',
    'build',
    '--platform',
    options.platform,
    '-f',
    'apps/server/Dockerfile',
    '-t',
    image,
    '--load',
    '.',
  ]);
} else {
  run('docker', ['build', '-f', 'apps/server/Dockerfile', '-t', image, '.']);
}

run('docker', ['save', image, '-o', tarPath]);

console.log(`
已完成：
  镜像：${image}
  文件：${tarPath}

下一步示例：
  scp "${tarPath}" user@server:/opt/momoya/api/

服务器上：
  cd /opt/momoya/api
  docker load -i ${tarName}
  sed -i 's/^MOMOYA_SERVER_TAG=.*/MOMOYA_SERVER_TAG=${tag}/' .env.docker
  docker compose --env-file .env.docker -f docker-compose.prod.yml up -d --no-deps server
  docker compose --env-file .env.docker -f docker-compose.prod.yml logs -f server
`);
