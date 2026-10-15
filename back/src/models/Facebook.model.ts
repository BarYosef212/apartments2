import mongoose, { Schema } from 'mongoose';

export type GroupDealType = 'sale' | 'rent' | 'any';

export interface FacebookGroupDocument extends mongoose.Document {
  name: string;
  url: string;
  dealType: GroupDealType;
  city: string;
}

/** The listing city named in a group's name, if any (longest match wins). */
export function guessGroupCity(name: string, cities: string[]) {
  return [...cities].sort((a, b) => b.length - a.length).find((c) => c && name.includes(c)) ?? '';
}

/** Guesses a group's deal type from its name, e.g. "דירות להשכרה בראשון". */
export function guessGroupDealType(name: string): GroupDealType {
  const rent = /השכרה|להשכיר|שכירות|rent/i.test(name);
  const sale = /מכירה|למכור|קנייה|לקנות|sale/i.test(name);
  return rent && !sale ? 'rent' : sale && !rent ? 'sale' : 'any';
}

export interface FacebookPostDocument extends mongoose.Document {
  apartmentId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  postedAt: Date;
}

const FacebookGroupSchema = new Schema<FacebookGroupDocument>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    // Which listings may be posted here: the queue never puts a sale listing
    // in a rentals group.
    dealType: { type: String, enum: ['sale', 'rent', 'any'], default: 'any' },
    // Empty = any city. A city group only gets listings from that city.
    city: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

/** That a listing was posted to a group (marked from the admin). */
const FacebookPostSchema = new Schema<FacebookPostDocument>({
  apartmentId: { type: Schema.Types.ObjectId, required: true, index: true },
  groupId: { type: Schema.Types.ObjectId, required: true },
  postedAt: { type: Date, required: true },
});
FacebookPostSchema.index({ apartmentId: 1, groupId: 1 }, { unique: true });

export interface FacebookPagePostDocument extends mongoose.Document {
  apartmentId: mongoose.Types.ObjectId;
  postId: string | null;
  postedAt: Date | null;
  error: string | null;
  attempts: number;
}

/** A listing published (or attempted) on the office's Page. */
const FacebookPagePostSchema = new Schema<FacebookPagePostDocument>(
  {
    apartmentId: { type: Schema.Types.ObjectId, required: true, unique: true },
    postId: { type: String, default: null },
    postedAt: { type: Date, default: null },
    error: { type: String, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const FacebookGroup = mongoose.model<FacebookGroupDocument>('facebook_groups', FacebookGroupSchema);
export const FacebookPost = mongoose.model<FacebookPostDocument>('facebook_posts', FacebookPostSchema);
export const FacebookPagePost = mongoose.model<FacebookPagePostDocument>('facebook_page_posts', FacebookPagePostSchema);

export type QueueJobStatus = 'pending' | 'sent' | 'posted' | 'failed' | 'skipped';

export interface FacebookQueueJobDocument extends mongoose.Document {
  day: string;
  apartmentId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  scheduledAt: Date;
  status: QueueJobStatus;
  sentAt: Date | null;
  doneAt: Date | null;
  note: string | null;
}

/** One planned post in the automatic queue (a listing to a group at a time). */
const FacebookQueueJobSchema = new Schema<FacebookQueueJobDocument>(
  {
    day: { type: String, required: true, index: true }, // YYYY-MM-DD, Israel time
    apartmentId: { type: Schema.Types.ObjectId, required: true },
    groupId: { type: Schema.Types.ObjectId, required: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'sent', 'posted', 'failed', 'skipped'], default: 'pending' },
    sentAt: { type: Date, default: null },
    doneAt: { type: Date, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

export const FacebookQueueJob = mongoose.model<FacebookQueueJobDocument>('facebook_queue_jobs', FacebookQueueJobSchema);
