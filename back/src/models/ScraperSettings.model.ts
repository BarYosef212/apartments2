import mongoose, { Schema } from 'mongoose';
import { ScraperSettingsDocument } from '../types/models.types';

const ScraperSettingsSchema = new Schema<ScraperSettingsDocument>(
  {
    yad2Urls: { type: [String], default: [] },
    yad2Url: { type: String, trim: true },
    intervalHours: { type: Number, default: 12, min: 1, max: 168 },
    enabled: { type: Boolean, default: false },
    lastRunAt: { type: Date, default: null },
    lastStatus: { type: String, enum: ['success', 'failed', 'running', null], default: null },
    lastError: { type: String, default: null },
    lastResult: {
      type: new Schema(
        {
          added: Number,
          updated: Number,
          deactivated: Number,
          total: Number,
          skipped: Number,
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

export const ScraperSettings = mongoose.model<ScraperSettingsDocument>('scraper_settings', ScraperSettingsSchema);

/** The collection holds a single document; create it on first access. */
export async function getSettingsDoc() {
  const existing = await ScraperSettings.findOne();
  if (existing) {
    // Migrate the old single-URL setting.
    if (existing.yad2Url && existing.yad2Urls.length === 0) {
      existing.yad2Urls = [existing.yad2Url];
      existing.yad2Url = undefined;
      await existing.save();
    }
    return existing;
  }
  return ScraperSettings.create({});
}
