import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PRESET_REPORT_TAGS,
  TAG_NAME_MAX,
  USER_TAG_PER_USER_LIMIT,
} from '@momoya/shared';
import type { TagDto } from '@momoya/shared';
import { ErrorKey } from '../../common/constants/error-keys';
import { toIsoString } from '../../common/utils/date';
import { UserTag, UserTagDocument } from './schemas/user-tag.schema';

@Injectable()
export class TagService {
  constructor(
    @InjectModel(UserTag.name)
    private readonly userTagModel: Model<UserTagDocument>,
  ) {}

  /** preset + 该用户 custom 的合并列表，preset 在前。 */
  async listForUser(userId: string): Promise<TagDto[]> {
    const customs = await this.userTagModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: 1 })
      .exec();

    const presetItems: TagDto[] = PRESET_REPORT_TAGS.map((name) => ({
      name,
      source: 'preset' as const,
      createdAt: '',
    }));

    const customItems: TagDto[] = customs
      // 若 custom 与 preset 同名，隐藏 custom（保持 preset 为权威），避免前端显示重复
      .filter((t) => !PRESET_REPORT_TAGS.includes(t.name as never))
      .map((t) => ({
        name: t.name,
        source: 'custom' as const,
        createdAt: toIsoString(t.createdAt),
      }));

    return [...presetItems, ...customItems];
  }

  /**
   * 新增 custom tag。
   * - name 不能与 preset 同名（由用户一侧避免误提）；
   * - 同一用户内 name 唯一；
   * - 该用户 custom 数量不得超过 USER_TAG_PER_USER_LIMIT。
   */
  async createForUser(userId: string, rawName: string): Promise<TagDto> {
    const name = rawName.trim();
    if (!name) {
      throw new BadRequestException({
        message: 'tag name 不能为空',
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    if (name.length > TAG_NAME_MAX) {
      throw new BadRequestException({
        message: `tag name 长度不得超过 ${TAG_NAME_MAX}`,
        errorKey: ErrorKey.E_VALIDATION,
      });
    }
    if (PRESET_REPORT_TAGS.includes(name as never)) {
      throw new ConflictException({
        message: '该 tag 已是系统预设，无需新增',
        errorKey: ErrorKey.E_TAG_DUPLICATE,
      });
    }

    const uid = new Types.ObjectId(userId);
    const count = await this.userTagModel
      .countDocuments({ userId: uid })
      .exec();
    if (count >= USER_TAG_PER_USER_LIMIT) {
      throw new BadRequestException({
        message: `自定义 tag 已达上限（${USER_TAG_PER_USER_LIMIT} 个）`,
        errorKey: ErrorKey.E_TAG_LIMIT,
      });
    }

    try {
      const doc = await this.userTagModel.create({ userId: uid, name });
      return {
        name: doc.name,
        source: 'custom',
        createdAt: toIsoString(doc.createdAt),
      };
    } catch (err: unknown) {
      // Mongoose duplicate key error
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: number }).code === 11000
      ) {
        throw new ConflictException({
          message: '该 tag 已存在',
          errorKey: ErrorKey.E_TAG_DUPLICATE,
        });
      }
      throw err;
    }
  }

  /**
   * 删除 custom tag。preset 不可删。
   * 不会去清理已经保存在历史 post 里的 tag（语义：历史保留，未来不可选）。
   */
  async removeForUser(userId: string, rawName: string): Promise<void> {
    const name = rawName.trim();
    if (PRESET_REPORT_TAGS.includes(name as never)) {
      throw new ForbiddenException({
        message: '系统预设 tag 不可删除',
        errorKey: ErrorKey.E_TAG_PRESET_READONLY,
      });
    }
    const res = await this.userTagModel
      .deleteOne({ userId: new Types.ObjectId(userId), name })
      .exec();
    if (res.deletedCount === 0) {
      throw new NotFoundException({
        message: 'tag 不存在',
        errorKey: ErrorKey.E_TAG_NOT_FOUND,
      });
    }
  }

  /**
   * 批量校验 tags 是否都在 "preset + 本人 custom" 范围内。
   * 报备发布 / 编辑时 PostService 调用。
   */
  async validateReportTags(userId: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;
    const customs = await this.userTagModel
      .find({ userId: new Types.ObjectId(userId) }, { name: 1 })
      .exec();
    const allowed = new Set<string>([
      ...PRESET_REPORT_TAGS,
      ...customs.map((t) => t.name),
    ]);
    for (const t of tags) {
      if (!allowed.has(t)) {
        throw new BadRequestException({
          message: `tag "${t}" 不在允许范围内`,
          errorKey: ErrorKey.E_VALIDATION,
        });
      }
    }
  }
}
