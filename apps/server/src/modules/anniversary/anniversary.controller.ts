import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseOf } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthUser } from '../auth/types/jwt-payload';
import { AnniversaryService } from './anniversary.service';
import {
  AnniversaryActionResultDto,
  AnniversaryDto,
  AnniversaryListDto,
} from './dto/anniversary.dto';
import { CreateAnniversaryDto } from './dto/create-anniversary.dto';
import { UpdateAnniversaryDto } from './dto/update-anniversary.dto';

@ApiTags('纪念日')
@Controller('anniversaries')
@UseGuards(JwtAccessGuard)
@ApiBearerAuth('access-token')
export class AnniversaryController {
  constructor(private readonly anniversaryService: AnniversaryService) {}

  @Get()
  @ApiOperation({
    summary: '列出当前情侣的纪念日',
    description: 'system 纪念日置顶，其余按 date 升序。未绑定伴侣会 403。',
  })
  @ApiOkResponse({ type: ApiResponseOf(AnniversaryListDto) })
  async list(@CurrentUser() auth: AuthUser): Promise<AnniversaryListDto> {
    const items = await this.anniversaryService.listForCouple(auth.userId);
    return { items };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '新增纪念日' })
  @ApiBody({ type: CreateAnniversaryDto })
  @ApiOkResponse({ type: ApiResponseOf(AnniversaryDto) })
  async create(
    @CurrentUser() auth: AuthUser,
    @Body() dto: CreateAnniversaryDto,
  ): Promise<AnniversaryDto> {
    return this.anniversaryService.create(auth.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '编辑纪念日',
    description:
      'system 纪念日只允许改 date，不允许改 name；普通纪念日双方任一都可改。',
  })
  @ApiParam({ name: 'id', example: '65f1c2e4a1b2c3d4e5f67890' })
  @ApiBody({ type: UpdateAnniversaryDto })
  @ApiOkResponse({ type: ApiResponseOf(AnniversaryDto) })
  async update(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAnniversaryDto,
  ): Promise<AnniversaryDto> {
    return this.anniversaryService.update(auth.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除纪念日',
    description: 'system 纪念日不可删，会返回 E_ANNIV_SYSTEM_READONLY。',
  })
  @ApiParam({ name: 'id', example: '65f1c2e4a1b2c3d4e5f67890' })
  @ApiOkResponse({ type: ApiResponseOf(AnniversaryActionResultDto) })
  async remove(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
  ): Promise<AnniversaryActionResultDto> {
    await this.anniversaryService.remove(auth.userId, id);
    return { ok: true };
  }
}
