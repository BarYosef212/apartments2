import mongoose, { Schema } from 'mongoose';
import { ApartmentDocument } from '../types/models.types';

const ApartmentSchema = new Schema<ApartmentDocument>(
  {
    img: { type: String, required: false, trim: true },
    price: { type: Number, required: true, index: true },
    street: { type: String, required: true, trim: true, index: true },
    city: { type: String, required: true, trim: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    info: { type: String, required: false, trim: true },
    rooms: { type: Number, required: false, index: true },
    floor: { type: Number, required: false },
    size: { type: Number, required: false },
    tags: { type: [String], default: [] },
    premium: {type:Boolean,required:false},
    dealType: { type: String, enum: ['sale', 'rent'], required: false, index: true },
    embedding: { type: [Number], required: false },
    source: { type: String, enum: ['manual', 'yad2'], default: 'manual', index: true },
    externalId: { type: String, required: false, index: { unique: true, sparse: true } },
    externalUrl: { type: String, required: false, trim: true },
    images: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, required: false },
    detailsFetchedAt: { type: Date, required: false },
  },
  { timestamps: true }
);


export const Apartment = mongoose.model<ApartmentDocument>('apartments', ApartmentSchema);