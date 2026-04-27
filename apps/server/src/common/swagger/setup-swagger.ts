import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SwaggerOptions {
  /** 挂载路径，不带前导斜杠，例如 'api/docs'。JSON 自动挂在 <path>-json。 */
  path: string;
}

/**
 * 在应用上挂载 Swagger UI 与 OpenAPI JSON。
 *
 * - UI:   GET /<path>           给浏览器看
 * - JSON: GET /<path>-json      给 Apifox / Postman 等工具拉
 *
 * 调用时机必须在 app.setGlobalPrefix 之后，否则 path 会带两次前缀。
 */
export function setupSwagger(
  app: INestApplication,
  { path }: SwaggerOptions,
): void {
  const config = new DocumentBuilder()
    .setTitle('momoya API')
    .setDescription('情侣日常记录小程序服务端 API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });

  SwaggerModule.setup(path, app, document, {
    jsonDocumentUrl: `${path}-json`,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
