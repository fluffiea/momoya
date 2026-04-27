import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UserTagDocument = HydratedDocument<UserTag>;

/**
 * 用户自定义的「报备 Tag」。与用户强绑定，仅本人可见可用可删；
 * 每个用户数量受 USER_TAG_PER_USER_LIMIT 限制；同一用户内部 name 唯一。
 */
@Schema({ collection: 'user_tags', timestamps: true })
export class UserTag {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserTagSchema = SchemaFactory.createForClass(UserTag);

UserTagSchema.index({ userId: 1, name: 1 }, { unique: true });
