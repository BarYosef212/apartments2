import path from 'path';
import { chromium, BrowserContext, Page, Response } from 'playwright';

/** Normalised listing as extracted from Yad2 (no DB access in this file). */
export interface Yad2Listing {
  externalId: string;
  externalUrl: string;
  /** Set by the scraper from the list URL it came from. */
  dealType?: 'sale' | 'rent';
  price?: number;
  city?: string;
  street?: string;
  type?: string;
  rooms?: number;
  floor?: number;
  size?: number;
  images: string[];
  info?: string;
  /** From the item page: what the property includes, in Hebrew. */
  features?: string[];
  /** From the item page, e.g. "במצב שמור". */
  condition?: string;
}

export interface Yad2ItemDetails {
  images: string[];
  description?: string;
  features: string[];
  condition?: string;
}

/** Yad2's inProperty flags, labelled the way Yad2 shows them. */
const FEATURE_LABELS: Record<string, string> = {
  includeAirconditioner: 'מיזוג',
  includeTornado: 'מזגן טורנדו',
  includeBoiler: 'דוד שמש',
  includeBars: 'סורגים',
  includeFurniture: 'ריהוט',
  includeSecurityRoom: 'ממ״ד',
  includeBuildingShelter: 'מקלט',
  includeBalcony: 'מרפסת',
  includeElevator: 'מעלית',
  includeParking: 'חניה',
  includeWarehouse: 'מחסן',
  isHandicapped: 'גישה לנכים',
  isRenovated: 'משופצת',
  isPetsAllowed: 'חיות מחמד',
  isForPartners: 'מתאים לשותפים',
  isKitchenKosher: 'מטבח כשר',
};

export interface ExtractResult {
  listings: Yad2Listing[];
  /** Raw candidate items that looked like listings before mapping */
  candidates: number;
}

export class Yad2BlockedError extends Error {
  constructor() {
    super('Yad2 blocked the request (bot protection)');
    this.name = 'Yad2BlockedError';
  }
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BLOCK_MARKERS = [
  'shieldsquare',
  'radware',
  'captcha',
  'are you human',
  'are you a human',
  'access denied',
  'perfdrive',
  'validate.perfdrive',
  'bot manager',
];

export function looksBlocked(html: string, status?: number): boolean {
  if (status === 403 || status === 429) return true;
  const lower = html.toLowerCase();
  // A real Yad2 page always carries the Next.js data blob; challenge pages do not.
  if (lower.includes('__next_data__')) return false;
  return BLOCK_MARKERS.some((m) => lower.includes(m));
}

// ---------- JSON walking / mapping ----------

const asObj = (v: unknown): Record<string, any> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : null;

function textOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  const o = asObj(v);
  if (o) return textOf(o.text ?? o.name ?? o.value);
  return undefined;
}

function numOf(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.\-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function looksLikeListing(o: Record<string, any>): boolean {
  const hasId = o.token != null || o.orderId != null || o.id != null || o.adNumber != null;
  const hasPrice = o.price != null;
  const hasAddr = o.address != null || o.city != null || o.street != null || o.title != null;
  return hasId && hasPrice && hasAddr;
}

/** Recursively collect objects that look like listings. */
export function findListingObjects(root: unknown): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 25 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const el of node) {
        const o = asObj(el);
        if (o && looksLikeListing(o)) out.push(o);
        else walk(el, depth + 1);
      }
      return;
    }
    for (const v of Object.values(node as Record<string, unknown>)) walk(v, depth + 1);
  };
  walk(root, 0);
  return out;
}

export function mapListing(raw: Record<string, any>): Yad2Listing | null {
  const id = raw.token ?? raw.orderId ?? raw.adNumber ?? raw.id;
  if (id == null || id === '') return null;
  const externalId = String(id);

  const addr = asObj(raw.address) ?? {};
  const details = asObj(raw.additionalDetails) ?? {};
  const meta = asObj(raw.metaData) ?? {};

  const city = textOf(addr.city) ?? textOf(raw.city) ?? textOf(raw.cityText);
  const street =
    textOf(addr.street) ?? textOf(raw.street) ?? textOf(raw.streetText) ?? textOf(addr.neighborhood) ?? textOf(raw.neighborhood);
  const type =
    textOf(details.property) ?? textOf(raw.propertyType) ?? textOf(raw.property) ?? textOf(raw.HomeTypeID_text) ?? textOf(raw.type);
  const house = asObj(addr.house) ?? {};

  const images: string[] = [];
  const pushImg = (v: unknown) => {
    const s = typeof v === 'string' ? v : textOf(asObj(v)?.src ?? asObj(v)?.url);
    if (!s || !/^https?:\/\//.test(s)) return;
    const clean = stripImageParams(s);
    if (!images.includes(clean)) images.push(clean);
  };
  pushImg(meta.coverImage);
  for (const arr of [meta.images, raw.images, raw.imagesUrls]) {
    if (Array.isArray(arr)) arr.forEach(pushImg);
  }

  const info = textOf(meta.description) ?? textOf(raw.description) ?? textOf(raw.info) ?? textOf(raw.searchText);

  return {
    externalId,
    externalUrl: `https://www.yad2.co.il/item/${externalId}`,
    price: numOf(raw.price),
    city,
    street,
    type,
    rooms: numOf(details.roomsCount ?? raw.roomsCount ?? raw.rooms),
    floor: numOf(house.floor ?? raw.floor),
    size: numOf(details.squareMeter ?? raw.squareMeter ?? raw.squareMeters ?? raw.size),
    images,
    info,
  };
}

export function parseNextData(html: string): unknown | null {
  const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function dedupe(items: Yad2Listing[]): Yad2Listing[] {
  const map = new Map<string, Yad2Listing>();
  for (const i of items) {
    const prev = map.get(i.externalId);
    // keep the richer record
    if (!prev || (i.images.length > prev.images.length)) map.set(i.externalId, { ...prev, ...i });
  }
  return [...map.values()];
}

// ---------- Browser ----------

async function launch(): Promise<BrowserContext> {
  const profileDir = path.resolve(process.env.PLAYWRIGHT_PROFILE_DIR || path.join(process.cwd(), '.playwright-profile'));
  return chromium.launchPersistentContext(profileDir, {
    headless: process.env.HEADLESS !== 'false',
    userAgent: USER_AGENT,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    viewport: { width: 1366, height: 900 },
  });
}

/**
 * Yad2 serves a 640px image by default and resizes on request (?w=&h=&c=9),
 * so store the bare URL and let the site pick the size.
 */
function stripImageParams(url: string) {
  return /^https:\/\/img\.yad2\.co\.il\//.test(url) ? url.split('?')[0] : url;
}

const YAD2_IMAGE_RE = /^https:\/\/img\.yad2\.co\.il\/.+\.(jpe?g|png|webp)(\?.*)?$/i;

/** Collect Yad2 image URLs under `node`, without descending into other listings. */
function collectImages(node: unknown, externalId: string, out: Map<string, string>, depth = 0) {
  if (depth > 15 || node == null) return;
  if (typeof node === 'string') {
    if (YAD2_IMAGE_RE.test(node)) {
      const clean = stripImageParams(node);
      if (!out.has(clean)) out.set(clean, clean);
    }
    return;
  }
  if (typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const el of node) collectImages(el, externalId, out, depth + 1);
    return;
  }
  const o = node as Record<string, any>;
  // Item pages also show "similar listings"; skip those.
  if (depth > 0 && looksLikeListing(o) && String(o.token ?? o.orderId ?? o.adNumber ?? o.id) !== externalId) return;
  for (const v of Object.values(o)) collectImages(v, externalId, out, depth + 1);
}

/** Find the objects describing `externalId` anywhere in the JSON. */
function findItemObjects(root: unknown, externalId: string): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 25 || seen.has(node)) return;
    seen.add(node);
    const o = asObj(node);
    // Keep descending after a match: the id also appears on wrappers (page
    // props, query state) above the item object that holds the details.
    if (o && [o.token, o.orderId, o.adNumber, o.id].some((v) => v != null && String(v) === externalId)) {
      out.push(o);
    }
    for (const v of Object.values(node as Record<string, unknown>)) walk(v, depth + 1);
  };
  walk(root, 0);
  return out;
}

const MAX_LIST_PAGES = 30;
const LIST_PAGE_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Agency pages are paginated ({ pagination: { totalPages } }, ?page=N). */
function findTotalPages(root: unknown): number {
  let total = 1;
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 25 || seen.has(node)) return;
    seen.add(node);
    const o = asObj(node);
    if (o && typeof o.totalPages === 'number') total = Math.max(total, o.totalPages);
    for (const v of Object.values(node as Record<string, unknown>)) walk(v, depth + 1);
  };
  walk(root, 0);
  return total;
}

function withPage(url: string, page: number) {
  const u = new URL(url);
  u.searchParams.set('page', String(page));
  return u.toString();
}

/** Opens `url`, waits for it to settle, and returns its HTML plus Yad2 JSON responses. */
async function loadPage(page: Page, url: string): Promise<{ json: unknown[] }> {
  const json: unknown[] = [];
  const onResponse = async (resp: Response) => {
    try {
      const u = resp.url();
      if (!/yad2\.co\.il/.test(u) || !/gw|api|feed/i.test(u)) return;
      if (!(resp.headers()['content-type'] || '').includes('json')) return;
      json.push(await resp.json());
    } catch {
      /* ignore unreadable bodies */
    }
  };
  page.on('response', onResponse);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // The listing data is server-rendered into __NEXT_DATA__, so it is there as
    // soon as the DOM is. Only pages without it need to wait for XHRs. (Yad2
    // never goes network-idle because of analytics, so that wait always times out.)
    const hasNextData = await page.$('script#__NEXT_DATA__').then(Boolean);
    if (!hasNextData) await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    const html = await page.content();
    if (looksBlocked(html, resp?.status())) throw new Yad2BlockedError();
    const nextData = parseNextData(html);
    if (nextData) json.unshift(nextData);
    return { json };
  } finally {
    page.off('response', onResponse);
  }
}

export interface Yad2Session {
  /** Extract the listings shown on a Yad2 list page (e.g. an agency page). */
  extractListings(url: string): Promise<ExtractResult>;
  /** Open a single listing page: its full gallery, description and features. */
  extractItemDetails(listing: Pick<Yad2Listing, 'externalId' | 'externalUrl'>): Promise<Yad2ItemDetails>;
  close(): Promise<void>;
}

/**
 * Opens one browser for a whole scan, so the list pages and item pages share
 * cookies. Methods throw Yad2BlockedError when a bot-protection challenge is
 * detected (never tries to bypass it). Does not touch the DB.
 */
export async function openYad2Session(): Promise<Yad2Session> {
  const context = await launch();
  const page = await context.newPage();

  return {
    async extractListings(url) {
      const first = await loadPage(page, url);
      const json = [...first.json];
      const totalPages = Math.min(Math.max(...first.json.map(findTotalPages), 1), MAX_LIST_PAGES);
      for (let n = 2; n <= totalPages; n++) {
        await sleep(LIST_PAGE_DELAY_MS);
        json.push(...(await loadPage(page, withPage(url, n))).json);
      }
      const raws = json.flatMap((j) => findListingObjects(j));
      const mapped = raws.map(mapListing).filter((x): x is Yad2Listing => !!x);
      return { listings: dedupe(mapped), candidates: raws.length };
    },

    async extractItemDetails({ externalId, externalUrl }) {
      // Only this item's own data: the rendered page also shows other
      // listings ("similar ads"), so scraping the HTML would mix them in.
      const { json } = await loadPage(page, externalUrl);
      const items = json.flatMap((j) => findItemObjects(j, externalId));

      const found = new Map<string, string>();
      for (const item of items) collectImages(item, externalId, found);

      const details: Yad2ItemDetails = { images: [...found.values()], features: [] };
      for (const item of items) {
        details.description ??= textOf(asObj(item.metaData)?.description);
        details.condition ??= textOf(asObj(item.additionalDetails)?.propertyCondition);
        const inProperty = asObj(item.inProperty);
        if (inProperty && details.features.length === 0) {
          details.features = Object.entries(FEATURE_LABELS)
            .filter(([key]) => inProperty[key] === true)
            .map(([, label]) => label);
        }
      }
      return details;
    },

    async close() {
      await context.close().catch(() => undefined);
    },
  };
}

/** One-off helper: open a browser, extract one list page, close. */
export async function extractListings(url: string): Promise<ExtractResult> {
  const session = await openYad2Session();
  try {
    return await session.extractListings(url);
  } finally {
    await session.close();
  }
}
