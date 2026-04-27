import * as path from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule, utilities } from 'nest-winston';
import * as winston from 'winston';
import configuration, { type AppConfig } from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { AnniversaryModule } from './modules/anniversary/anniversary.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { PostModule } from './modules/post/post.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TagModule } from './modules/tag/tag.module';
import { UploadModule } from './modules/upload/upload.module';
import { UserModule } from './modules/user/user.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: true },
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            utilities.format.nestLike('momoya', {
              colors: true,
              prettyPrint: true,
            }),
          ),
        }),
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodbUri'),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const upload = config.get<AppConfig['upload']>('upload')!;
        return [
          {
            rootPath: path.isAbsolute(upload.dir)
              ? upload.dir
              : path.resolve(process.cwd(), upload.dir),
            serveRoot: '/static',
            serveStaticOptions: {
              index: false,
              fallthrough: false,
              maxAge: '7d',
            },
          },
        ];
      },
    }),
    UserModule,
    AuthModule,
    UploadModule,
    TagModule,
    PostModule,
    RealtimeModule,
    AnniversaryModule,
    HealthModule,
    SeedModule,
  ],
})
export class AppModule {}
