export type ScrapeStatus = 'success' | 'failed' | 'running' | null;

export interface ScrapeCounts {
  added: number;
  updated: number;
  deactivated: number;
  total: number;
}

export interface ScraperSettings {
  yad2Urls: string[];
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt?: string | null;
  lastStatus?: ScrapeStatus;
  lastError?: string | null;
  lastResult?: ScrapeCounts | null;
}

export type ScraperSettingsInput = Pick<
  ScraperSettings,
  'yad2Urls' | 'intervalMinutes' | 'enabled'
>;

export interface ScraperStatus extends Partial<ScraperSettings> {
  running: boolean;
  nextRunAt?: string | null;
}

export interface ScrapeLog {
  _id: string;
  startedAt: string;
  finishedAt?: string | null;
  trigger: 'manual' | 'schedule';
  status: ScrapeStatus;
  error?: string | null;
  counts?: Partial<ScrapeCounts> | null;
}
