import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';
import {
  ErrorCode,
  ErrorKey,
  ErrorKeyType,
  httpStatusToErrorKey,
} from '../constants/error-keys';

interface ErrorResponseBody {
  code: number;
  data: null;
  msg: string;
  errorKey: ErrorKeyType;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let msg = 'Internal server error';
    let errorKey: ErrorKeyType = ErrorKey.E_INTERNAL;

    // 兜底：@nestjs/platform-express 会把 multer 错误封装成 HttpException，
    // 以下分支只有在直接抛 MulterError 时才会命中（保留以防御）。
    if (exception instanceof MulterError) {
      switch (exception.code) {
        case 'LIMIT_FILE_SIZE':
          httpStatus = HttpStatus.PAYLOAD_TOO_LARGE;
          errorKey = ErrorKey.E_UPLOAD_TOO_LARGE;
          msg = '文件超过大小限制';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
        case 'LIMIT_FILE_COUNT':
          httpStatus = HttpStatus.BAD_REQUEST;
          errorKey = ErrorKey.E_UPLOAD_MISSING;
          msg = '文件字段不正确，请检查字段名';
          break;
        default:
          httpStatus = HttpStatus.BAD_REQUEST;
          errorKey = ErrorKey.E_VALIDATION;
          msg = exception.message || '文件上传失败';
      }
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        msg = resBody;
      } else if (typeof resBody === 'object' && resBody !== null) {
        const maybeMsg = (resBody as { message?: unknown }).message;
        if (Array.isArray(maybeMsg)) {
          msg = maybeMsg.join('; ');
        } else if (typeof maybeMsg === 'string') {
          msg = maybeMsg;
        } else {
          msg = exception.message;
        }
        const providedKey = (resBody as { errorKey?: unknown }).errorKey;
        if (typeof providedKey === 'string' && providedKey in ErrorCode) {
          errorKey = providedKey as ErrorKeyType;
        }
      }
      if (errorKey === ErrorKey.E_INTERNAL) {
        errorKey = httpStatusToErrorKey[httpStatus] ?? ErrorKey.E_INTERNAL;
      }

      // 润色 platform-express 把 multer 错误转成的英文信息。
      if (
        errorKey === ErrorKey.E_UPLOAD_TOO_LARGE &&
        /^File too large$/i.test(msg)
      ) {
        msg = '文件超过大小限制';
      } else if (
        httpStatus === HttpStatus.BAD_REQUEST &&
        /^Unexpected field/i.test(msg)
      ) {
        msg = '文件字段名必须为 file';
        errorKey = ErrorKey.E_UPLOAD_MISSING;
      }
    } else if (exception instanceof Error) {
      msg = exception.message || msg;
      this.logger.error(
        `Unhandled exception at ${request.method} ${request.url}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unknown exception at ${request.method} ${request.url}`,
        String(exception),
      );
    }

    const body: ErrorResponseBody = {
      code: ErrorCode[errorKey],
      data: null,
      msg,
      errorKey,
    };

    response.status(httpStatus).json(body);
  }
}
