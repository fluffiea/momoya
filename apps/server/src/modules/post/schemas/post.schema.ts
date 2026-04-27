import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { PostType } from '@momoya/shared';

export type PostDocument = HydratedDocument<Post>;

/**
 * 统一的「帖子」collection，承载日常（daily）与报备（report）两种类型。
 *
 * - 不显式存 coupleId：双人可见通过 `authorId ∈ {me, partnerId}` 过滤即可（MVP 单对情侣）。
 * - 软删：`deletedAt` 非空即视为已删。
 * - `happenedAt`：事件实际发生时间，默认 = createdAt；列表排序主键（优于 createdAt，允许补记）。
 * - `readAt`：仅对 `type='report'` 有意义，partner 点击"已阅"后打点；daily 恒为 null。
 */
@Schema({ collection: 'posts', timestamps: true })
export class Post {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  authorId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['daily', 'report'] })
  type!: PostType;

  @Prop({ type: String, required: true, default: '' })
  text!: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Date, required: true, default: () => new Date(), index: true })
  happenedAt!: Date;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  deletedAt!: Date | null;

  // 由 timestamps: true 自动维护，仅声明类型供 TS 推断
  createdAt!: Date;
  updatedAt!: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// 主列表索引：按作者过滤 + 按 happenedAt 倒序
PostSchema.index({ authorId: 1, happenedAt: -1 });
// 报备 "我发的" filter + 游标分页
PostSchema.index({ authorId: 1, type: 1, happenedAt: -1 });
// Cursor 分页辅助索引：(happenedAt, _id) 组合 desc，跨作者时用
PostSchema.index({ type: 1, happenedAt: -1, _id: -1 });
