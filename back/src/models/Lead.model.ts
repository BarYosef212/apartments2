import mongoose, { Schema } from 'mongoose';
import { LeadDocument } from '../types/models.types';

export const LEAD_REASONS = ['viewing', 'valuation', 'general'] as const;

const LeadSchema = new Schema<LeadDocument>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    reason: { type: String, enum: LEAD_REASONS, default: 'general' },
    message: { type: String, trim: true, default: '' },
    // A snapshot, so the lead still reads right if the listing changes.
    apartment: {
      type: new Schema(
        { id: String, street: String, city: String, url: String },
        { _id: false }
      ),
      default: null,
    },
    emailStatus: { type: String, enum: ['sent', 'failed', 'not_configured'], required: true },
    emailError: { type: String, default: null },
  },
  { timestamps: true }
);

export const Lead = mongoose.model<LeadDocument>('leads', LeadSchema);
