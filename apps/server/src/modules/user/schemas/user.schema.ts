import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  DEFAULT_REPORT_LIST_FILTER,
  DEFAULT_WITNESS_TAB,
  type ReportFilter,
  type WitnessDefaultTab,
} from '@momoya/shared';

export type UserDocument = HydratedDocument<User>;

/**
 * 用户级偏好。未来加新开关都放这个子文档，避免扁平化 User。
 * 没有强制默认值的情况下 Mongo 里可能缺字段，service 读取时会兜底。
 */
@Schema({ _id: false })
export class UserSettings {
  @Prop({
    type: String,
    enum: ['daily', 'report'],
    default: DEFAULT_WITNESS_TAB,
  })
  defaultWitnessTab!: WitnessDefaultTab;

  @Prop({
    type: String,
    enum: ['all', 'unread', 'mine'],
    default: DEFAULT_REPORT_LIST_FILTER,
  })
  defaultReportListFilter!: ReportFilter;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true, index: true })
  username!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: String, required: true })
  nickname!: string;

  @Prop({ type: String, default: '' })
  avatar!: string;

  @Prop({ type: String, default: '' })
  bio!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  partnerId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  currentSessionId!: string | null;

  @Prop({ type: Date, default: null })
  lastOnlineAt!: Date | null;

  @Prop({
    type: UserSettingsSchema,
    default: () => ({
      defaultWitnessTab: DEFAULT_WITNESS_TAB,
      defaultReportListFilter: DEFAULT_REPORT_LIST_FILTER,
    }),
  })
  settings!: UserSettings;
}

export const UserSchema = SchemaFactory.createForClass(User);
