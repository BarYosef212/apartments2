import { Apartment } from '../models/Apartment.model';
import { ScrapeLog } from '../models/ScrapeLog.model';
import { getSettingsDoc, ScraperSettings } from '../models/ScraperSettings.model';
import { EmbeddingController } from '../controllers/embedding.controller';
import { ScrapeCounts } from '../types/models.types';
import { autoPostNewListings } from './facebookPage.service';
import { openYad2Session, Yad2BlockedError, Yad2Listing, Yad2Session } from './yad2Extractor';

export type ScrapeTrigger = 'manual' | 'schedule';

export class ScrapeAlreadyRunningError extends Error {
  constructor() {
    super('A scan is already running');
    this.name = 'ScrapeAlreadyRunningError';
  }
}

// Item pages are visited one by one; keep the pace gentle and the run bounded.
const ITEM_PAGE_DELAY_MS = 3000;
const MAX_ITEM_PAGES_PER_RUN = 60;
const DETAILS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Bump when item pages yield new fields, so existing listings are re-read.
const DETAILS_VERSION = 2;
// Fields that only come from the item page.
const DETAIL_FIELDS = ['images', 'img', 'info', 'features', 'condition'] as const;

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
    price: l.price ?? 0,
    city: l.city,
    street: l.street,
    type: l.type,
    rooms: l.rooms,
    floor: l.floor,
    size: l.size,
    info: l.info,
    features: l.features,
    condition: l.condition,
    img: l.images[0],
    images: l.images,
    externalUrl: l.externalUrl,
    dealType: l.dealType,
  };
}

/** Yad2 list URLs say the deal type: /realestate/forsale, /agency/<id>/rent, ... */
function dealTypeOf(url: string): Yad2Listing['dealType'] {
  const path = new URL(url).pathname;
  if (/\/rent(\/|$)/.test(path)) return 'rent';
  if (/\/forsale(\/|$)/.test(path)) return 'sale';
  return undefined;
}

// Price is optional: agencies often list "price on request" (price 0).
function isValid(l: Yad2Listing) {
  return !!(l.street && l.city && l.type);
}

/**
 * Visits the item page of listings that are new, changed in price, or not
 * checked recently, for the full gallery, description and features.
 * Returns the ids whose item page was read. Stops early if Yad2 blocks us;
 * those listings keep what the list page had.
 */
async function fetchDetails(session: Yad2Session, listings: Yad2Listing[]): Promise<Set<string>> {
  const existing = await Apartment.find({ externalId: { $in: listings.map((l) => l.externalId) } })
    .select('externalId price detailsFetchedAt detailsVersion')
    .lean();
  const byId = new Map(existing.map((e) => [e.externalId, e]));
  const staleBefore = Date.now() - DETAILS_MAX_AGE_MS;

  const due = listings
    .filter((l) => {
      const e = byId.get(l.externalId);
      return (
        !e ||
        !e.detailsFetchedAt ||
        (e.detailsVersion ?? 1) < DETAILS_VERSION ||
        e.detailsFetchedAt.getTime() < staleBefore ||
        e.price !== (l.price ?? 0)
      );
    })
    .slice(0, MAX_ITEM_PAGES_PER_RUN);

  const fetched = new Set<string>();
  for (const [i, l] of due.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, ITEM_PAGE_DELAY_MS));
    try {
      const details = await session.extractItemDetails(l);
      if (details.images.length > 0) l.images = details.images;
      l.info = details.description ?? l.info;
      l.features = details.features;
      l.condition = details.condition;
      fetched.add(l.externalId);
    } catch (err) {
      if (err instanceof Yad2BlockedError) {
        console.warn(`[scraper] blocked on item pages after ${fetched.size}/${due.length}; keeping list images`);
        break;
      }
      console.error(`[scraper] item ${l.externalId} failed:`, (err as Error).message);
    }
  }
  return fetched;
}

/**
 * Upserts listings and returns counts. Listings not seen in this run are
 * deactivated only when `deactivateMissing` is set, i.e. every URL was scanned.
 */
async function persist(
  listings: Yad2Listing[],
  runStartedAt: Date,
  deactivateMissing: boolean,
  detailsFetched: Set<string>
): Promise<ScrapeCounts> {
  const counts: ScrapeCounts = { added: 0, updated: 0, deactivated: 0, total: listings.length, skipped: 0 };

  for (const l of listings) {
    if (!isValid(l)) {
      counts.skipped!++;
      continue;
    }
    const doc = toDoc(l);
    const existing = await Apartment.findOne({ externalId: l.externalId }).select('price city street type rooms size detailsFetchedAt');
    const changed =
      !existing ||
      existing.price !== doc.price ||
      existing.city !== doc.city ||
      existing.street !== doc.street ||
      existing.type !== doc.type ||
      existing.rooms !== doc.rooms ||
      existing.size !== doc.size;

    const set: Record<string, any> = { ...doc, source: 'yad2', active: true, lastSeenAt: new Date() };
    if (detailsFetched.has(l.externalId)) {
      set.detailsFetchedAt = new Date();
      set.detailsVersion = DETAILS_VERSION;
    } else if (existing?.detailsFetchedAt) {
      // Keep what an earlier run read from the item page over the list
      // page's preview (one photo, no description or features).
      for (const field of DETAIL_FIELDS) delete set[field];
    }
    if (changed) {
      const embedding = await tryEmbed(doc);
      if (embedding) set.embedding = embedding;
    }

    await Apartment.updateOne({ externalId: l.externalId }, { $set: set }, { upsert: true });
    if (existing) counts.updated++;
    else counts.added++;
  }

  if (!deactivateMissing) return counts;

  const res = await Apartment.updateMany(
    { source: 'yad2', active: { $ne: false }, lastSeenAt: { $lt: runStartedAt } },
    { $set: { active: false } }
  );
  counts.deactivated = res.modifiedCount;
  return counts;
}

/**
 * Scans each list URL in turn (a listing may appear in more than one), then
 * reads the item pages, all in one browser session.
 */
async function scanUrls(urls: string[]) {
  const byId = new Map<string, Yad2Listing>();
  const failures: string[] = [];
  let detailsFetched = new Set<string>();

  const session = await openYad2Session();
  try {
    for (const url of urls) {
      try {
        const { listings } = await session.extractListings(url);
        if (!listings.some(isValid)) {
          throw new Error(
            listings.length === 0
              ? 'Scan found 0 listings (page structure may have changed)'
              : `Scan found ${listings.length} items but none had the required fields`
          );
        }
        const dealType = dealTypeOf(url);
        for (const l of listings) byId.set(l.externalId, { ...l, dealType });
      } catch (err) {
        const msg = (err as Error).message || 'Unknown error';
        console.error(`[scraper] ${url} failed:`, msg);
        failures.push(urls.length === 1 ? msg : `${url}: ${msg}`);
      }
    }
    if (failures.length < urls.length) {
      detailsFetched = await fetchDetails(session, [...byId.values()].filter(isValid));
    }
  } finally {
    await session.close();
  }
  return { listings: [...byId.values()], failures, detailsFetched };
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
    const urls = settings.yad2Urls;
    if (urls.length === 0) throw new Error('Yad2 URL is not configured');

    const { listings, failures, detailsFetched } = await scanUrls(urls);
    if (failures.length === urls.length) throw new Error(failures.join('\n'));

    // A failed URL would make its listings look removed, so only deactivate
    // when every URL was scanned successfully.
    const counts = await persist(listings, startedAt, failures.length === 0, detailsFetched);
    settings.lastResult = counts;
    log.counts = counts;
    if (failures.length > 0) {
      const msg = failures.join('\n');
      settings.lastStatus = 'failed';
      settings.lastError = msg;
      log.status = 'failed';
      log.error = msg;
    } else {
      settings.lastStatus = 'success';
      log.status = 'success';
    }
    // Runs after the scan is recorded; spaced out, so don't hold the scan open.
    void autoPostNewListings();
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

/**
 * A scan only lives in this process, so anything still marked running at
 * startup was cut off by a restart.
 */
export async function markInterruptedScans() {
  const error = 'Server restarted during scan';
  await ScrapeLog.updateMany(
    { status: 'running' },
    { $set: { status: 'failed', error, finishedAt: new Date() } }
  );
  await ScraperSettings.updateMany(
    { lastStatus: 'running' },
    { $set: { lastStatus: 'failed', lastError: error } }
  );
}

/** Fire-and-forget starter used by the API: throws 409-type error synchronously-ish, then runs in background. */
export function startScrapeInBackground(trigger: ScrapeTrigger) {
  if (running) throw new ScrapeAlreadyRunningError();
  runScrape(trigger).catch((e) => console.error('[scraper] unexpected', e));
}
