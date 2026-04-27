import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { setupSwagger } from './common/swagger/setup-swagger';
import type { AppConfig } from './config/configuration';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const configEarly = app.get(ConfigService);
  const redisUrl =
    configEarly.get<string>('redisUrl') ?? 'redis://127.0.0.1:6379';
  const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.setGlobalPrefix('api/v1', {
    exclude: ['static', 'static/(.*)'],
  });
  // Helmet 默认 CORP 可能拦截 Socket.IO 首次 HTTP long-polling 握手；小程序端也依赖 polling → websocket 升级
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;

  const swaggerCfg = config.get<AppConfig['swagger']>('swagger');
  if (swaggerCfg?.enabled) {
    setupSwagger(app, { path: swaggerCfg.path });
  }

  // 显式绑 0.0.0.0，让局域网里的真机 / 虚拟机可访问（默认行为也是这样，
  // 但写出来避免未来某次无意间改成 127.0.0.1）。
  await app.listen(port, '0.0.0.0');

  logger.log(
    `momoya server listening on http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
  logger.log(
    `  (LAN access) 手机真机调试请用电脑的局域网 IPv4 访问 :${port}，并放行 Windows 防火墙入站`,
    'Bootstrap',
  );
  if (swaggerCfg?.enabled) {
    logger.log(
      `swagger ui:   http://localhost:${port}/${swaggerCfg.path}`,
      'Bootstrap',
    );
    logger.log(
      `openapi json: http://localhost:${port}/${swaggerCfg.path}-json`,
      'Bootstrap',
    );
  }
}

void bootstrap();
