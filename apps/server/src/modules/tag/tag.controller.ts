import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreateTagDto } from './dto/create-tag.dto';
import { TagActionResultDto, TagDto, TagListDto } from './dto/tag.dto';
import { TagService } from './tag.service';

@ApiTags('报备 Tag')
@Controller('tags')
@UseGuards(JwtAccessGuard)
@ApiBearerAuth('access-token')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @ApiOperation({
    summary: '列表（preset + 本人 custom）',
    description: 'preset 在前，custom 按创建时间升序排列。',
  })
  @ApiOkResponse({ type: ApiResponseOf(TagListDto) })
  async list(@CurrentUser() auth: AuthUser): Promise<TagListDto> {
    const items = await this.tagService.listForUser(auth.userId);
    return { items };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '新增自定义 tag',
    description: `每用户最多 30 个；不能与系统 preset 重名。`,
  })
  @ApiBody({ type: CreateTagDto })
  @ApiOkResponse({ type: ApiResponseOf(TagDto) })
  async create(
    @CurrentUser() auth: AuthUser,
    @Body() dto: CreateTagDto,
  ): Promise<TagDto> {
    return this.tagService.createForUser(auth.userId, dto.name);
  }

  @Delete(':name')
  @ApiOperation({
    summary: '删除自定义 tag',
    description: 'preset 不可删；历史 post 里已存的 tag 保留。',
  })
  @ApiParam({ name: 'name', example: '约会' })
  @ApiOkResponse({ type: ApiResponseOf(TagActionResultDto) })
  async remove(
    @CurrentUser() auth: AuthUser,
    @Param('name') name: string,
  ): Promise<TagActionResultDto> {
    await this.tagService.removeForUser(auth.userId, decodeURIComponent(name));
    return { ok: true };
  }
}
