import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AnniversaryDto } from '@momoya/shared';
import {
  ANNIVERSARY_PER_COUPLE_LIMIT,
  SYSTEM_ANNIVERSARY_TOGETHER,
} from '@momoya/shared';
import { ErrorKey } from '../../common/constants/error-keys';
import { toIsoString } from '../../common/utils/date';
import { makeCoupleKey } from '../../common/couple-key';
import { CoupleRealtimeService } from '../realtime/couple-realtime.service';
import { UserService } from '../user/user.service';
import { CreateAnniversaryDto } from './dto/create-anniversary.dto';
import { UpdateAnniversaryDto } from './dto/update-anniversary.dto';
import {
  Anniversary,
  AnniversaryDocument,
} from './schemas/anniversary.schema';

/**
 * 把任意日期归一化到当天的 UTC 零点，保证相同"日"无论原本几点几分存进来都是同一个 Date。
 * 前端做距今/距下次天数计算时也只关心年月日。
 */
function normalizeDate(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({
      message: 'date 不是合法的 ISO 日期',
      errorKey: ErrorKey.E_VALIDATION,
    });
  }
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** PATCH 纪念日 `date`：保留到 UTC 分钟（秒、毫秒归零），供「在一起」设置精确到分。 */
function normalizeDateTimeToUtcMinute(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({
      message: 'date 不是合法的 ISO 日期时间',
      errorKey: ErrorKey.E_VALIDATION,
    });
  }
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      0,
      0,
    ),
  );
}

@Injectable()
export class AnniversaryService {
  constructor(
    @InjectModel(Anniversary.name)
    private readonly anniversaryModel: Model<AnniversaryDocument>,
    private readonly userService: UserService,
    private readonly coupleRealtime: CoupleRealtimeService,
  ) {}

  /**
   * 查当前用户的 coupleKey。
   * 必须已绑定 partner 才允许操作 anniversary；未绑定时前端基本不会触发，
   * 但接口层仍兜底报 `E_ANNIV_FORBIDDEN`，避免一个人的纪念日被静默创建。
   */
  private async requireCoupleKey(userId: string): Promise<string> {
    const me = await this.userService.findById(userId);
    if (!me) {
      throw new NotFoundException({
        message: '用户不存在',
        errorKey: ErrorKey.E_NOT_FOUND,
      });
    }
    if (!me.partnerId) {
      throw new ForbiddenException({
        message: '尚未绑定伴侣，无法操作纪念日',
        errorKey: ErrorKey.E_ANNIV_FORBIDDEN,
      });
    }
    return makeCoupleKey(String(me._id), String(me.partnerId));
  }

  async listForCouple(userId: string): Promise<AnniversaryDto[]> {
    const coupleKey = await this.requireCoupleKey(userId);
    // system 置顶；其余按 date 升序（最近要到的在前）
    const docs = await this.anniversaryModel
      .find({ coupleKey })
      .sort({ isSystem: -1, date: 1 })
      .exec();
    return docs.map((d) => toDto(d));
  }

  async create(
    userId: string,
    dto: CreateAnniversaryDto,
  ): Promise<AnniversaryDto> {
    const coupleKey = await this.requireCoupleKey(userId);
    const count = await this.anniversaryModel
      .countDocuments({ coupleKey })
      .exec();
    if (count >= ANNIVERSARY_PER_COUPLE_LIMIT) {
      throw new BadRequestException({
        message: `纪念日数量已达上限（${ANNIVERSARY_PER_COUPLE_LIMIT}）`,
        errorKey: ErrorKey.E_VALIDATION,
      });
    }

    const doc = await this.anniversaryModel.create({
      coupleKey,
      name: dto.name.trim(),
      date: normalizeDate(dto.date),
      createdBy: new Types.ObjectId(userId),
      isSystem: false,
    });
    const result = toDto(doc);
    this.coupleRealtime.emitAnniversaryCreated(coupleKey, result);
    return result;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAnniversaryDto,
  ): Promise<AnniversaryDto> {
    const doc = await this.findAuthorized(userId, id);

    if (dto.name !== undefined) {
      if (doc.isSystem) {
        throw new ForbiddenException({
          message: '系统纪念日不可改名',
          errorKey: ErrorKey.E_ANNIV_SYSTEM_READONLY,
        });
      }
      doc.name = dto.name.trim();
    }
    if (dto.date !== undefined) {
      const nextDate = doc.isSystem
        ? normalizeDateTimeToUtcMinute(dto.date)
        : normalizeDate(dto.date);
      if (nextDate.getTime() !== doc.date.getTime()) {
        doc.date = nextDate;
        doc.lastDateEditedBy = new Types.ObjectId(userId);
      }
    }

    await doc.save();
    const result = toDto(doc);
    this.coupleRealtime.emitAnniversaryUpdated(doc.coupleKey, result);
    return result;
  }

  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.findAuthorized(userId, id);
    if (doc.isSystem) {
      throw new ForbiddenException({
        message: '系统纪念日不可删除',
        errorKey: ErrorKey.E_ANNIV_SYSTEM_READONLY,
      });
    }
    const coupleKey = doc.coupleKey;
    const idStr = String(doc._id);
    await doc.deleteOne();
    this.coupleRealtime.emitAnniversaryDeleted(coupleKey, idStr);
  }

  /**
   * 拉出 id 对应的 anniversary，并校验它属于当前 couple。
   * 对"别人家"的 id 一律 NotFound，避免探测。
   */
  private async findAuthorized(
    userId: string,
    id: string,
  ): Promise<AnniversaryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        message: '纪念日不存在',
        errorKey: ErrorKey.E_ANNIV_NOT_FOUND,
      });
    }
    const coupleKey = await this.requireCoupleKey(userId);
    const doc = await this.anniversaryModel
      .findOne({ _id: new Types.ObjectId(id), coupleKey })
      .exec();
    if (!doc) {
      throw new NotFoundException({
        message: '纪念日不存在',
        errorKey: ErrorKey.E_ANNIV_NOT_FOUND,
      });
    }
    return doc;
  }

  /**
   * seed 使用：幂等地为 couple 注入「在一起」系统纪念日。
   * 已存在则跳过，不存在则用 `fallbackDate` 初始化（一般是较早用户的 createdAt）。
   */
  async ensureSystemTogether(
    coupleKey: string,
    fallbackDate: Date,
  ): Promise<void> {
    const exists = await this.anniversaryModel
      .findOne({ coupleKey, isSystem: true, name: SYSTEM_ANNIVERSARY_TOGETHER })
      .exec();
    if (exists) return;
    await this.anniversaryModel.create({
      coupleKey,
      name: SYSTEM_ANNIVERSARY_TOGETHER,
      date: new Date(
        Date.UTC(
          fallbackDate.getUTCFullYear(),
          fallbackDate.getUTCMonth(),
          fallbackDate.getUTCDate(),
        ),
      ),
      createdBy: null,
      isSystem: true,
    });
  }
}

function toDto(doc: AnniversaryDocument): AnniversaryDto {
  return {
    id: String(doc._id),
    name: doc.name,
    date: toIsoString(doc.date),
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    isSystem: doc.isSystem,
    lastDateEditedBy: doc.lastDateEditedBy
      ? String(doc.lastDateEditedBy)
      : null,
    createdAt: toIsoString(doc.createdAt),
    updatedAt: toIsoString(doc.updatedAt),
  };
}
