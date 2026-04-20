import mongoose from 'mongoose';

const reportTagSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false },
);

const profileSchema = new mongoose.Schema(
  {
    displayName: { type: String, default: '' },
    bio: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    /** 日常 Tab 默认视图：'daily' | 'report' */
    dailyDefaultView: {
      type: String,
      enum: ['daily', 'report'],
      default: 'daily',
    },
    /**
     * 用户级自定义报备 tag 库：下次撰写报备时可以直接勾选；内置「干饭」「没干饭」不入库。
     * 整组覆盖写入；数组上限 30 条，label 在写入时会被归一化（trim + 长度裁剪）。
     */
    reportTags: {
      type: [reportTagSchema],
      default: () => [],
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    /** 每次成功登录自增；与 session.authVersion 比对以实现单设备会话 */
    authSessionVersion: { type: Number, default: 0 },
    profile: { type: profileSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type UserDoc = mongoose.InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User = mongoose.model('User', userSchema);
