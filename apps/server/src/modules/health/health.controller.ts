import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Connection } from 'mongoose';
import { ApiResponseOf } from '../../common/dto/api-response.dto';
import { HealthDataDto } from './dto/health.dto';

@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({
    summary: '服务健康检查',
    description:
      '返回服务端与 MongoDB 的连通状态，可用于容器 healthcheck 与上线 smoke test。',
  })
  @ApiOkResponse({ type: ApiResponseOf(HealthDataDto) })
  async check(): Promise<HealthDataDto> {
    const mongo = this.connection.readyState === 1 ? 'up' : 'down';
    return { status: 'ok', mongo };
  }
}
