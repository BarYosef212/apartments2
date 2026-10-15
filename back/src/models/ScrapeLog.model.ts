import mongoose, { Schema } from 'mongoose';
import { ScrapeLogDocument } from '../types/models.types';

const ScrapeLogSchema = new Schema<ScrapeLogDocument>({
  startedAt: { type: Date, required: true, index: true },
  finishedAt: { type: Date },
  trigger: { type: String, enum: ['manual', 'schedule'], required: true },
  status: { type: String, enum: ['success', 'failed', 'running'], required: true },
  error: { type: String },
  counts: {
    type: new Schema(
      { added: Number, updated: Number, deactivated: Number, total: Number, skipped: Number },
      { _id: false }
    ),
  },
});

export const ScrapeLog = mongoose.model<ScrapeLogDocument>('scrape_logs', ScrapeLogSchema);
