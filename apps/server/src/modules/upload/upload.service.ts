import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALLOWED_IMAGE_MIME, ErrorKey } from '@momoya/shared';
import type { AppConfig } from '../../config/configuration';

/** 从 shared 重新导出，保持旧引入路径可用（upload.module.ts 在用）。 */
export { ALLOWED_IMAGE_MIME };

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly maxSizeBytes: number;
  private readonly staticBaseUrl: string;

  constructor(config: ConfigService) {
    const upload = config.get<AppConfig['upload']>('upload')!;
    this.uploadDir = path.isAbsolute(upload.dir)
      ? upload.dir
      : path.resolve(process.cwd(), upload.dir);
    this.maxSizeBytes = upload.maxSizeBytes;
    this.staticBaseUrl = upload.staticBaseUrl.replace(/\/+$/, '');

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  getMaxSizeBytes(): number {
    return this.maxSizeBytes;
  }

  getStaticBaseUrl(): string {
    return this.staticBaseUrl;
  }

  /** multer diskStorage 写盘成功后，把 file 信息拼成对外响应。 */
  finalize(file: Express.Multer.File) {
    const resolvedBase = path.resolve(this.uploadDir);
    const resolvedFile = path.resolve(file.path);
    const relToBase = path.relative(resolvedBase, resolvedFile);
    if (
      relToBase.startsWith('..') ||
      path.isAbsolute(relToBase) ||
      relToBase === ''
    ) {
      this.logger.warn(
        `Reject finalize: resolved path escapes upload dir (${resolvedFile})`,
      );
      throw new BadRequestException({
        message: '非法上传路径',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    const relativePath = relToBase.replace(/\\/g, '/');
    const url = `/static/${relativePath}`;
    const absoluteUrl = `${this.staticBaseUrl}/${relativePath}`;
    return {
      url,
      absoluteUrl,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
