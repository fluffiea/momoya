import mongoose from 'mongoose';

const dailyCommentSchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, index: true },
    /** null = 顶级评论；非 null = 回复某条评论的 _id */
    parentId: { type: String, default: null, index: true },
    body: { type: String, required: true },
    username: { type: String, required: true },
  },
  { timestamps: true },
);

export const DailyCommentModel = mongoose.model('DailyComment', dailyCommentSchema);
