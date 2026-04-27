export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  mongodbUri: string;
  /** Socket.IO `@socket.io/redis-adapter` 使用的连接串（compose 内为 redis://redis:6379） */
  redisUrl: string;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  upload: {
    dir: string;
    staticBaseUrl: string;
    maxSizeBytes: number;
  };
  swagger: {
    enabled: boolean;
    path: string;
  };
}

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export default (): AppConfig => {
  const nodeEnv =
    (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.PORT ?? '3000', 10),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/momoya',
    redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '2h',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '14d',
    },
    upload: {
      dir: process.env.UPLOAD_DIR ?? './uploads',
      staticBaseUrl:
        process.env.STATIC_BASE_URL ?? 'http://localhost:3000/static',
      maxSizeBytes: parseInt(
        process.env.UPLOAD_MAX_SIZE_BYTES ?? '5242880',
        10,
      ),
    },
    swagger: {
      enabled: parseBool(process.env.SWAGGER_ENABLED, nodeEnv !== 'production'),
      path: process.env.SWAGGER_PATH ?? 'api/docs',
    },
  };
};
