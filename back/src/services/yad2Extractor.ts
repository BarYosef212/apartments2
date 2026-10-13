import path from 'path';
import { chromium, BrowserContext, Page } from 'playwright';

/** Normalised listing as extracted from Yad2 (no DB access in this file). */
export interface Yad2Listing {
  externalId: string;
  externalUrl: string;
  price?: number;
  city?: string;
  street?: string;
  type?: string;
  rooms?: number;
  floor?: number;
  size?: number;
  images: string[];
  info?: string;
}

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
    if (s && /^https?:\/\//.test(s) && !images.includes(s)) images.push(s);
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
 * Open the Yad2 URL and extract listings. Does not touch the DB.
 * Throws Yad2BlockedError when a bot-protection challenge is detected (never tries to bypass it).
 */
export async function extractListings(url: string): Promise<ExtractResult> {
  const context = await launch();
  try {
    const page: Page = await context.newPage();
    const xhrJson: unknown[] = [];
    page.on('response', async (resp) => {
      try {
        const u = resp.url();
        if (!/yad2\.co\.il/.test(u) || !/gw|api|feed/i.test(u)) return;
        if (!(resp.headers()['content-type'] || '').includes('json')) return;
        xhrJson.push(await resp.json());
      } catch {
        /* ignore unreadable bodies */
      }
    });

    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

    const html = await page.content();
    if (looksBlocked(html, resp?.status())) throw new Yad2BlockedError();

    const raws: Record<string, any>[] = [];
    const nextData = parseNextData(html);
    if (nextData) raws.push(...findListingObjects(nextData));
    for (const j of xhrJson) raws.push(...findListingObjects(j));

    const mapped = raws.map(mapListing).filter((x): x is Yad2Listing => !!x);
    return { listings: dedupe(mapped), candidates: raws.length };
  } finally {
    await context.close().catch(() => undefined);
  }
}
