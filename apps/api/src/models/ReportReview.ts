import mongoose from 'mongoose';

/**
 * 报备评价：每条 kind='report' 的 DailyEntry，最多让"非创建者"写一条评价。
 * 数据模型预留扩展性（后续可加 reactions、score 字段，不影响现有契约）。
 *
 * 唯一性：(entryId, username) 唯一；upsert 时覆盖 body。
 */
const reportReviewSchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, index: true },
    username: { type: String, required: true, index: true },
    body: { type: String, required: true },
  },
  { timestamps: true },
);

reportReviewSchema.index({ entryId: 1, username: 1 }, { unique: true });

export const ReportReviewModel = mongoose.model('ReportReview', reportReviewSchema);
