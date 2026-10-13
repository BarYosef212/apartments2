import { Document } from 'mongoose';

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
  intervalHours: number;
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
