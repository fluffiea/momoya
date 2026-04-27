// MongoDB 首次初始化脚本（仅在 /data/db 为空时执行）。
// 运行环境：mongo:7 镜像自带 mongosh 2.x，可访问 process.env。
// 作用：在业务数据库 momoya 上创建一个 readWrite 权限的应用账号，
//      供 NestJS 服务连接使用，避免以 root 账号跑业务流量。

const database = 'momoya';
const username = process.env.MOMOYA_APP_USERNAME;
const password = process.env.MOMOYA_APP_PASSWORD;

if (!username || !password) {
  print('[momoya-init] MOMOYA_APP_USERNAME / MOMOYA_APP_PASSWORD 未设置，跳过应用账号创建');
} else {
  const appDb = db.getSiblingDB(database);
  const existing = appDb.getUser(username);
  if (existing) {
    print(`[momoya-init] 应用账号 '${username}' 已存在于 '${database}'，跳过`);
  } else {
    appDb.createUser({
      user: username,
      pwd: password,
      roles: [{ role: 'readWrite', db: database }],
    });
    print(`[momoya-init] 已创建应用账号 '${username}' 于 '${database}'`);
  }
}
