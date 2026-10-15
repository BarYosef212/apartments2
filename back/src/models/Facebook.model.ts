import mongoose, { Schema } from 'mongoose';

export interface FacebookGroupDocument extends mongoose.Document {
  name: string;
  url: string;
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
