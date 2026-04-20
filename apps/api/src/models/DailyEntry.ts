import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false },
);

const ackSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const dailyEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    /** 报备允许仅图片无正文：路由层校验；daily 创建仍要求非空正文 */
    body: { type: String, default: '' },
    tags: { type: [tagSchema], default: [] },
    images: { type: [String], default: [] },
    createdByUsername: { type: String },
    updatedByUsername: { type: String },
    /**
     * 记录类型：
     * - daily：日常（双方可写、互评）
     * - report：报备（报告方单向发 → 对方可已阅/评价）
     * 旧数据无此字段时，读路径一律视作 'daily'
     */
    kind: {
      type: String,
      enum: ['daily', 'report'],
      default: 'daily',
      index: true,
    },
    /** 报备专用：已阅回执；约定一人一次性追加（业务层不撤销） */
    acks: { type: [ackSchema], default: [] },
  },
  { timestamps: true },
);

// 旧：{ at: -1 }；新增复合索引 { kind, at, _id } 用于按 kind 过滤的游标分页
dailyEntrySchema.index({ at: -1 });
dailyEntrySchema.index({ kind: 1, at: -1, _id: -1 });

export const DailyEntryModel = mongoose.model('DailyEntry', dailyEntrySchema);
