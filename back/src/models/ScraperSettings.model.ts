import mongoose, { Schema } from 'mongoose';
import { ScraperSettingsDocument } from '../types/models.types';

const ScraperSettingsSchema = new Schema<ScraperSettingsDocument>(
  {
    yad2Urls: { type: [String], default: [] },
    yad2Url: { type: String, trim: true },
    // No default, so a document from before minutes existed can be migrated.
    intervalMinutes: { type: Number, min: 10, max: 10080 },
    intervalHours: { type: Number },
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

const DEFAULT_INTERVAL_HOURS = 12;

export const ScraperSettings = mongoose.model<ScraperSettingsDocument>('scraper_settings', ScraperSettingsSchema);

/** The collection holds a single document; create it on first access. */
export async function getSettingsDoc() {
  const existing = await ScraperSettings.findOne();
  if (existing) {
    // Migrate the old single-URL setting.
    let migrated = false;
    if (existing.yad2Url && existing.yad2Urls.length === 0) {
      existing.yad2Urls = [existing.yad2Url];
      existing.yad2Url = undefined;
      migrated = true;
    }
    // Migrate the old hours setting.
    if (existing.intervalMinutes == null) {
      existing.intervalMinutes = (existing.intervalHours ?? DEFAULT_INTERVAL_HOURS) * 60;
      existing.intervalHours = undefined;
      migrated = true;
    }
    if (migrated) await existing.save();
    return existing;
  }
  return ScraperSettings.create({ intervalMinutes: DEFAULT_INTERVAL_HOURS * 60 });
}
