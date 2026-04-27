import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type EvaluationDocument = HydratedDocument<Evaluation>;

/**
 * 评价：partner 对一条 post 的一句话回应。
 *
 * - 每条 post 至多一条评价（`{postId}` unique index）；
 * - 只能由 post 作者的 partner 写；
 * - 可修改（UPSERT）但不可删除。
 */
@Schema({ collection: 'evaluations', timestamps: true })
export class Evaluation {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Post',
    required: true,
    unique: true,
  })
  postId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  text!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const EvaluationSchema = SchemaFactory.createForClass(Evaluation);
