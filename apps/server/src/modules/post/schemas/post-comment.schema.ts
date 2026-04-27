import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PostCommentDocument = HydratedDocument<PostComment>;

/**
 * 日常（daily）post 下的双人评论（软删）。
 *
 * 两层结构：
 * - `parentId=null` 为一级评论；
 * - `parentId` 非空时必须指向同 `postId` 下、`deletedAt=null`、且**本身也是一级**
 *   （被指向者 `parentId=null`）的评论；否则写入拒绝（由 service 保证）。
 *
 * 「锁」语义：一级评论一旦存在未删回复，便只能编辑，不能删除（`E_POST_COMMENT_LOCKED`）。
 *
 * 旧数据兼容：历史文档没有 `parentId` / `editedAt` 字段时，读取时应视作 `null`。
 */
@Schema({ collection: 'post_comments', timestamps: true })
export class PostComment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  postId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  authorId!: Types.ObjectId;

  /** null=一级评论；非空=二级回复（回复的回复不允许）。 */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'PostComment',
    default: null,
    index: true,
  })
  parentId!: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  text!: string;

  /** 最近一次编辑时间；首次创建为 null，编辑后永久非空。 */
  @Prop({ type: Date, default: null })
  editedAt!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);

// 一级评论按 postId + createdAt 升序翻页（详情页主查询）
PostCommentSchema.index({ postId: 1, parentId: 1, createdAt: 1 });
// 针对某一级评论取全部回复
PostCommentSchema.index({ parentId: 1, createdAt: 1 });
