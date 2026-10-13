import { Apartment } from '../models/Apartment.model';
import { ScrapeLog } from '../models/ScrapeLog.model';
import { getSettingsDoc } from '../models/ScraperSettings.model';
import { EmbeddingController } from '../controllers/embedding.controller';
import { ScrapeCounts } from '../types/models.types';
import { extractListings, Yad2Listing } from './yad2Extractor';

export type ScrapeTrigger = 'manual' | 'schedule';

export class ScrapeAlreadyRunningError extends Error {
  constructor() {
    super('A scan is already running');
    this.name = 'ScrapeAlreadyRunningError';
  }
}

let running = false;
let ec: EmbeddingController | null = null;

export function isScrapeRunning() {
  return running;
}

async function tryEmbed(data: Record<string, any>): Promise<number[] | undefined> {
  try {
    if (!ec) ec = new EmbeddingController();
    return await ec.embedProperty(data as any);
  } catch (err) {
    console.error('[scraper] embedding failed (ignored):', (err as Error).message);
    return undefined;
  }
}

function toDoc(l: Yad2Listing) {
  return {
    price: l.price,
    city: l.city,
    street: l.street,
    type: l.type,
    rooms: l.rooms,
    floor: l.floor,
    size: l.size,
    info: l.info,
    img: l.images[0],
    images: l.images,
    externalUrl: l.externalUrl,
  };
}

function isValid(l: Yad2Listing) {
  return !!(l.price && l.price > 0 && l.street && l.city && l.type);
}

/** Upserts listings, returns counts. Deactivation is done by the caller flow here too. */
async function persist(listings: Yad2Listing[], runStartedAt: Date): Promise<ScrapeCounts> {
  const counts: ScrapeCounts = { added: 0, updated: 0, deactivated: 0, total: listings.length, skipped: 0 };

  for (const l of listings) {
    if (!isValid(l)) {
      counts.skipped!++;
      continue;
    }
    const doc = toDoc(l);
    const existing = await Apartment.findOne({ externalId: l.externalId }).select('price city street type rooms size');
    const changed =
      !existing ||
      existing.price !== doc.price ||
      existing.city !== doc.city ||
      existing.street !== doc.street ||
      existing.type !== doc.type ||
      existing.rooms !== doc.rooms ||
      existing.size !== doc.size;

    const set: Record<string, any> = { ...doc, source: 'yad2', active: true, lastSeenAt: new Date() };
    if (changed) {
      const embedding = await tryEmbed(doc);
      if (embedding) set.embedding = embedding;
    }

    await Apartment.updateOne({ externalId: l.externalId }, { $set: set, $setOnInsert: { externalId: l.externalId } }, { upsert: true });
    if (existing) counts.updated++;
    else counts.added++;
  }

  const res = await Apartment.updateMany(
    { source: 'yad2', active: { $ne: false }, lastSeenAt: { $lt: runStartedAt } },
    { $set: { active: false } }
  );
  counts.deactivated = res.modifiedCount;
  return counts;
}

/**
 * Runs a scan to completion. Throws ScrapeAlreadyRunningError if one is in progress.
 * Resolves with the log id; failures are recorded in settings/log rather than thrown.
 */
export async function runScrape(trigger: ScrapeTrigger): Promise<void> {
  if (running) throw new ScrapeAlreadyRunningError();
  running = true;

  const startedAt = new Date();
  const settings = await getSettingsDoc();
  const log = await ScrapeLog.create({ startedAt, trigger, status: 'running' });
  settings.lastStatus = 'running';
  settings.lastRunAt = startedAt;
  settings.lastError = null;
  await settings.save();

  try {
    if (!settings.yad2Url) throw new Error('Yad2 URL is not configured');
    const { listings } = await extractListings(settings.yad2Url);
    const valid = listings.filter(isValid);
    if (valid.length === 0) {
      throw new Error(
        listings.length === 0
          ? 'Scan found 0 listings (page structure may have changed)'
          : `Scan found ${listings.length} items but none had the required fields`
      );
    }
    const counts = await persist(listings, startedAt);
    settings.lastStatus = 'success';
    settings.lastResult = counts;
    log.status = 'success';
    log.counts = counts;
  } catch (err) {
    const msg = (err as Error).message || 'Unknown error';
    console.error('[scraper] run failed:', msg);
    settings.lastStatus = 'failed';
    settings.lastError = msg;
    log.status = 'failed';
    log.error = msg;
  } finally {
    log.finishedAt = new Date();
    await log.save().catch(() => undefined);
    await settings.save().catch(() => undefined);
    running = false;
  }
}

/** Fire-and-forget starter used by the API: throws 409-type error synchronously-ish, then runs in background. */
export function startScrapeInBackground(trigger: ScrapeTrigger) {
  if (running) throw new ScrapeAlreadyRunningError();
  runScrape(trigger).catch((e) => console.error('[scraper] unexpected', e));
}
