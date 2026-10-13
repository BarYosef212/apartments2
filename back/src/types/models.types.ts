import { Document } from 'mongoose';

export type DealType = 'sale' | 'rent';

export interface ApartmentDocument extends Document {
  img?: string;
  price: number;
  street: string;
  city: string;
  type: string;
  info?: string;
  rooms?: number;
  floor?: number;
  size?: number;
  tags?: string[];
  premium?:boolean,
  dealType?: DealType,
  embedding?: number[] | undefined;
  source?: 'manual' | 'yad2';
  externalId?: string;
  externalUrl?: string;
  images?: string[];
  active?: boolean;
  lastSeenAt?: Date;
  /** When the item page itself (full image gallery) was last scraped. */
  detailsFetchedAt?: Date;
}

export type ScrapeStatus = 'success' | 'failed' | 'running';

export interface ScrapeCounts {
  added: number;
  updated: number;
  deactivated: number;
  total: number;
  skipped?: number;
}

export interface ScraperSettingsDocument extends Document {
  yad2Urls: string[];
  /** @deprecated single-URL setting, migrated into yad2Urls on read */
  yad2Url?: string;
  intervalMinutes: number;
  /** @deprecated migrated into intervalMinutes on read */
  intervalHours?: number;
  enabled: boolean;
  lastRunAt?: Date | null;
  lastStatus?: ScrapeStatus | null;
  lastError?: string | null;
  lastResult?: ScrapeCounts | null;
}

export interface ScrapeLogDocument extends Document {
  startedAt: Date;
  finishedAt?: Date;
  trigger: 'manual' | 'schedule';
  status: ScrapeStatus;
  error?: string;
  counts?: ScrapeCounts;
}

export interface UserDocument extends Document {
  email: string;
  password: string;
  role: 'admin';
}

export interface SiteContact {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  license: string;
  leadsEmail: string;
}

export interface SiteTexts {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  ownersTitle: string;
  ownersText: string;
}

export interface SiteSettingsDocument extends Document {
  heroMedia: { kind: 'image' | 'video'; url: string };
  ownersImage: string;
  texts: SiteTexts;
  contact: SiteContact;
}

export type LeadReason = 'viewing' | 'valuation' | 'general';

export interface LeadDocument extends Document {
  name: string;
  phone: string;
  email: string;
  reason: LeadReason;
  message: string;
  apartment: { id: string; street: string; city: string; url: string } | null;
  emailStatus: 'sent' | 'failed' | 'not_configured';
  emailError: string | null;
  createdAt: Date;
}
