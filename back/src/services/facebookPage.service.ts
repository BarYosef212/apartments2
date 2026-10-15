import { Apartment } from '../models/Apartment.model';
import { FacebookPagePost } from '../models/Facebook.model';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import { renderPost } from '../lib/postText';
import { decryptSecret } from './secrets.service';

// Official Page publishing through Meta's Graph API (allowed, unlike groups).
const GRAPH = `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || 'v23.0'}`;
const MAX_PHOTOS = 10;
// A few listings per scan keeps the Page from flooding followers' feeds;
// the rest go out on the following scans.
const AUTO_POSTS_PER_RUN = 3;
const AUTO_POST_GAP_MS = 60 * 1000;
const MAX_ATTEMPTS = 3;

export class FacebookPageError extends Error {}

async function graph(path: string, token: string, body?: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data.error) throw new FacebookPageError(data.error?.message ?? `HTTP ${res.status}`);
  return data;
}

async function pageConfig() {
  const s = await getSiteSettingsDoc();
  const { pageId, tokenEncrypted } = s.facebookPage ?? ({} as any);
  if (!pageId || !tokenEncrypted) throw new FacebookPageError('Page is not configured');
  return { settings: s, pageId, token: decryptSecret(tokenEncrypted) };
}

/** Public, full-size image URLs Facebook can fetch. */
function photoUrls(images: string[], siteUrl: string) {
  return images.slice(0, MAX_PHOTOS).flatMap((url) => {
    if (/^https:\/\/img\.yad2\.co\.il\//.test(url)) return [`${url.split('?')[0]}?w=1600&h=1600&c=9`];
    if (url.startsWith('/uploads/') && siteUrl.startsWith('https://')) return [`${siteUrl}${url}`];
    if (/^https:\/\//.test(url)) return [url];
    return [];
  });
}

export async function testPageConnection() {
  const { pageId, token } = await pageConfig();
  const page = await graph(`${encodeURIComponent(pageId)}?fields=name,link`, token);
  return { name: page.name as string, link: page.link as string | undefined };
}

/** Publishes one listing to the Page as a multi-photo post. */
export async function publishToPage(apartmentId: string) {
  const { settings, pageId, token } = await pageConfig();
  const apartment = await Apartment.findById(apartmentId).select('-embedding').lean();
  if (!apartment) throw new FacebookPageError('Listing not found');

  const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
  const message = renderPost(settings.facebookTemplate, apartment as any, {
    phone: settings.contact?.phone,
    license: settings.contact?.license,
    siteUrl,
  });

  const record =
    (await FacebookPagePost.findOne({ apartmentId })) ?? new FacebookPagePost({ apartmentId });
  record.attempts += 1;
  try {
    const images = apartment.images?.length ? apartment.images : apartment.img ? [apartment.img] : [];
    const media: { media_fbid: string }[] = [];
    for (const url of photoUrls(images, siteUrl)) {
      const photo = await graph(`${pageId}/photos`, token, { url, published: false });
      media.push({ media_fbid: photo.id });
    }
    const post = await graph(`${pageId}/feed`, token, {
      message,
      ...(media.length > 0 && { attached_media: media }),
    });
    record.postId = post.id;
    record.postedAt = new Date();
    record.error = null;
  } catch (err) {
    record.error = (err as Error).message;
    await record.save();
    throw err;
  }
  await record.save();
  return record.toObject();
}

/**
 * After a scan: posts new listings (added since auto-posting was enabled)
 * that are not on the Page yet, a few at a time. Never throws.
 */
export async function autoPostNewListings() {
  try {
    const s = await getSiteSettingsDoc();
    const fp = s.facebookPage;
    if (!fp?.autoPost || !fp.pageId || !fp.tokenEncrypted || !fp.autoPostSince) return;

    const done = await FacebookPagePost.find({
      $or: [{ postId: { $ne: null } }, { attempts: { $gte: MAX_ATTEMPTS } }],
    }).distinct('apartmentId');
    const due = await Apartment.find({
      _id: { $nin: done },
      active: { $ne: false },
      createdAt: { $gte: fp.autoPostSince },
    })
      .sort({ createdAt: 1 })
      .limit(AUTO_POSTS_PER_RUN)
      .select('_id')
      .lean();

    for (const [i, a] of due.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, AUTO_POST_GAP_MS));
      try {
        await publishToPage(String(a._id));
        console.info(`[facebook-page] posted ${a._id}`);
      } catch (err) {
        console.error(`[facebook-page] ${a._id} failed:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.error('[facebook-page] auto-post failed:', (err as Error).message);
  }
}
