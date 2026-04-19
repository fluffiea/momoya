import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false },
);

const dailyEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    body: { type: String, required: true },
    tags: { type: [tagSchema], default: [] },
    images: { type: [String], default: [] },
    createdByUsername: { type: String },
    updatedByUsername: { type: String },
  },
  { timestamps: true },
);

dailyEntrySchema.index({ at: -1 });

export const DailyEntryModel = mongoose.model('DailyEntry', dailyEntrySchema);
