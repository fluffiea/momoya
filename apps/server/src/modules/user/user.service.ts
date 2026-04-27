import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DEFAULT_REPORT_LIST_FILTER, DEFAULT_WITNESS_TAB } from '@momoya/shared';
import { MeDto } from './dto/me.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findByUsername(username: string) {
    return this.userModel.findOne({ username }).exec();
  }

  findById(id: string | Types.ObjectId) {
    return this.userModel.findById(id).exec();
  }

  /**
   * 批量取用户的公开基本信息（id/username/nickname/avatar），
   * 用于其他模块（如 Moments 列表）填充作者信息，避免每条 moment 单独查一次。
   */
  findManyBrief(ids: ReadonlyArray<string | Types.ObjectId>) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.userModel
      .find(
        { _id: { $in: ids } },
        { _id: 1, username: 1, nickname: 1, avatar: 1, createdAt: 1 },
      )
      .exec();
  }

  countAll() {
    return this.userModel.estimatedDocumentCount().exec();
  }

  /** 登录/改密后刷新会话与在线时间。传 null 可清除 session（登出）。 */
  async updateSession(
    userId: Types.ObjectId | string,
    sessionId: string | null,
  ) {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { currentSessionId: sessionId, lastOnlineAt: new Date() } },
      )
      .exec();
  }

  async updatePassword(userId: Types.ObjectId | string, passwordHash: string) {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { passwordHash } })
      .exec();
  }

  async touchOnline(userId: Types.ObjectId | string) {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { lastOnlineAt: new Date() } })
      .exec();
  }

  /**
   * 部分更新 profile 字段 + settings 子文档。
   * settings 走 dot-path 做 partial merge，避免覆盖整个子对象
   * （未来 settings 字段变多时单字段写入也不受影响）。
   * 返回更新后的完整 UserDocument；若没有任何字段要改则直接返回现状。
   */
  async updateProfile(
    userId: string | Types.ObjectId,
    dto: UpdateMeDto,
  ): Promise<UserDocument | null> {
    const $set: Record<string, unknown> = {};
    if (dto.nickname !== undefined) $set.nickname = dto.nickname;
    if (dto.bio !== undefined) $set.bio = dto.bio;
    if (dto.avatar !== undefined) $set.avatar = dto.avatar;
    if (dto.settings) {
      if (dto.settings.defaultWitnessTab !== undefined) {
        $set['settings.defaultWitnessTab'] = dto.settings.defaultWitnessTab;
      }
      if (dto.settings.defaultReportListFilter !== undefined) {
        $set['settings.defaultReportListFilter'] =
          dto.settings.defaultReportListFilter;
      }
    }

    if (Object.keys($set).length === 0) {
      return this.userModel.findById(userId).exec();
    }

    return this.userModel
      .findByIdAndUpdate(userId, { $set }, { new: true })
      .exec();
  }

  /** UserDocument → MeDto 的统一映射，避免多处散落。 */
  toMe(user: UserDocument): MeDto {
    // 老账号可能缺 settings，兜底给默认值
    const s = user.settings ?? {
      defaultWitnessTab: DEFAULT_WITNESS_TAB,
      defaultReportListFilter: DEFAULT_REPORT_LIST_FILTER,
    };
    return {
      id: String(user._id),
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      bio: user.bio,
      partnerId: user.partnerId ? String(user.partnerId) : null,
      settings: {
        defaultWitnessTab: s.defaultWitnessTab ?? DEFAULT_WITNESS_TAB,
        defaultReportListFilter:
          s.defaultReportListFilter ?? DEFAULT_REPORT_LIST_FILTER,
      },
    };
  }
}
