import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AnniversaryDocument = HydratedDocument<Anniversary>;

/**
 * 情侣共享的纪念日。
 *
 * 数据归属用 `coupleKey`：把 user 和 partner 的 ObjectId 字符串化后按字典序拼接
 * （形如 `"<smaller>-<larger>"`），两个人查到的 key 相同即共享一套纪念日。
 * 这样每条 anniversary 只存一份，读写都按 key 过滤。
 *
 * `isSystem = true` 的行是在 seed / 首次绑定 partner 时自动生成的「在一起」，
 * 不可删、不可改名，只能改日期；普通 anniversary（当前版本前端没暴露入口，但
 * 接口预留了）两端都可增删改。
 */
@Schema({ collection: 'anniversaries', timestamps: true })
export class Anniversary {
  /** 情侣唯一键，由双方 userId 字典序拼接得到；查询主路径。 */
  @Prop({ type: String, required: true, index: true })
  coupleKey!: string;

  @Prop({ type: String, required: true })
  name!: string;

  /** 纪念日当天的 UTC 零点（我们只关心年月日，忽略时分秒）。 */
  @Prop({ type: Date, required: true })
  date!: Date;

  /** 创建者 userId；system 纪念日为 null。 */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  createdBy!: Types.ObjectId | null;

  /** 系统纪念日（当前仅「在一起」一条），不可删、不可改名。 */
  @Prop({ type: Boolean, default: false })
  isSystem!: boolean;

  /**
   * 最近一次通过 PATCH 修改 `date` 的用户；仅在实际变更 date 时写入。
   * 系统 seed 初始化为 null；`updatedAt` 表示该行最后一次任意保存时间。
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  lastDateEditedBy!: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AnniversarySchema = SchemaFactory.createForClass(Anniversary);

/**
 * 同一对情侣里，同名 system 纪念日只能有一条（防 seed 并发重复插）。
 * partial index 只约束 isSystem=true 行，普通行允许同名同日期重复。
 */
AnniversarySchema.index(
  { coupleKey: 1, name: 1 },
  { unique: true, partialFilterExpression: { isSystem: true } },
);
