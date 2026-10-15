import crypto from 'crypto';
import { Apartment } from '../models/Apartment.model';
import { FacebookGroup, FacebookPost, FacebookQueueJob } from '../models/Facebook.model';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import { pickVariant, renderPost } from '../lib/postText';
import { isMailConfigured, sendMail } from './mail.service';

// The automatic queue for Facebook groups. The server decides what to post
// and when; the Chrome extension asks for the next due post, posts it in the
// person's own browser, and reports back. Pace is deliberately slow: Meta's
// anti-spam acts on bursts and repetition.

export const QUEUE_BOUNDS = {
  postsPerDay: [1, 10],
  groupsPerListing: [1, 3],
  startHour: [6, 22],
  endHour: [8, 23],
  minGapMinutes: [15, 180],
  repostDays: [3, 60],
} as const;

const WARNING_PAUSE_HOURS = 48;
const FAILURES_BEFORE_PAUSE = 3;
const FAILURE_PAUSE_HOURS = 24;
// A post handed to the extension that never reports back is given up on.
const SENT_TIMEOUT_MS = 15 * 60 * 1000;

const TZ = 'Asia/Jerusalem';

// ----- Israel time -----

/** Today's date in Israel, YYYY-MM-DD. */
export function israelDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

/** The instant of a given hour today in Israel. */
function israelHourToday(hour: number, now = new Date()) {
  const wall = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const offset = wall.getTime() - now.getTime(); // Israel's offset from this server
  const midnightWall = new Date(wall);
  midnightWall.setHours(0, 0, 0, 0);
  return new Date(midnightWall.getTime() + hour * 3600 * 1000 - offset);
}

// ----- Extension key -----

const hashKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

/** A new key for the extension; only its hash is stored. */
export async function issueExtensionKey() {
  const key = crypto.randomBytes(32).toString('hex');
  const s = await getSiteSettingsDoc();
  s.facebookQueue.extensionKeyHash = hashKey(key);
  s.markModified('facebookQueue');
  await s.save();
  return key;
}

export async function verifyExtensionKey(key: string | undefined) {
  if (!key) return false;
  const s = await getSiteSettingsDoc();
  const stored = s.facebookQueue?.extensionKeyHash;
  if (!stored) return false;
  const a = Buffer.from(stored, 'hex');
  const b = Buffer.from(hashKey(key), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ----- Alerts -----

async function alert(subject: string, body: string) {
  try {
    const s = await getSiteSettingsDoc();
    const to = s.facebookQueue.alertEmail || s.contact.leadsEmail || s.contact.email;
    if (!to || !(await isMailConfigured())) {
      console.warn('[queue] alert not emailed (no address or mail settings):', subject);
      return;
    }
    await sendMail({
      to,
      subject: `פרסום בפייסבוק: ${subject}`,
      text: body,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/\n/g, '<br>')}</div>`,
    });
  } catch (err) {
    console.error('[queue] alert email failed:', (err as Error).message);
  }
}

// ----- Planning -----

const shuffle = <T>(items: T[]) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Reorders so the same group never comes twice in a row when avoidable. */
function spreadGroups<T extends { groupId: string }>(items: T[]) {
  const rest = [...items];
  const out: T[] = [];
  while (rest.length) {
    const i = rest.findIndex((x) => x.groupId !== out[out.length - 1]?.groupId);
    out.push(...rest.splice(i === -1 ? 0 : i, 1));
  }
  return out;
}

/**
 * Builds today's plan once: random listings, each to a few random groups it
 * wasn't posted to recently, at random times spread over the working hours.
 */
export async function ensureTodayPlan(now = new Date(), { force = false } = {}) {
  const day = israelDay(now);
  if (!force && (await FacebookQueueJob.exists({ day }))) return;

  const s = await getSiteSettingsDoc();
  const q = s.facebookQueue;
  if (!q.enabled) return;
  // When re-planning mid-day, what already went out counts toward today.
  const alreadyToday = await FacebookQueueJob.countDocuments({ day, status: { $in: ['posted', 'sent'] } });
  const budget = q.postsPerDay - alreadyToday;
  if (budget <= 0) return;

  const windowStart = new Date(Math.max(now.getTime(), israelHourToday(q.startHour, now).getTime()));
  const windowEnd = israelHourToday(q.endHour, now);
  if (windowEnd.getTime() - windowStart.getTime() < q.minGapMinutes * 60 * 1000) return;

  const [apartments, groups, recent] = await Promise.all([
    Apartment.find({ active: { $ne: false }, img: { $nin: [null, ''] } }).select('_id dealType city').lean(),
    FacebookGroup.find().select('_id dealType city').lean(),
    FacebookPost.find({ postedAt: { $gte: new Date(now.getTime() - q.repostDays * 86400 * 1000) } })
      .select('apartmentId groupId')
      .lean(),
  ]);
  if (apartments.length === 0 || groups.length === 0) return;
  const recentPairs = new Set(recent.map((p) => `${p.apartmentId}:${p.groupId}`));

  const picks: { apartmentId: string; groupId: string }[] = [];
  for (const a of shuffle(apartments)) {
    if (picks.length >= budget) break;
    const free = shuffle(groups).filter(
      (g) =>
        // Only groups for this kind of deal (a group of either kind takes both).
        (g.dealType === 'any' || !g.dealType || g.dealType === a.dealType) &&
        // A city group only takes listings from its city.
        (!g.city || g.city === a.city) &&
        !recentPairs.has(`${a._id}:${g._id}`)
    );
    for (const g of free.slice(0, q.groupsPerListing)) {
      if (picks.length >= budget) break;
      picks.push({ apartmentId: String(a._id), groupId: String(g._id) });
    }
  }
  if (picks.length === 0) return;

  // Spread over the window: one slot each, at a random point inside it,
  // never closer than the minimum gap.
  const ordered = spreadGroups(shuffle(picks));
  const span = windowEnd.getTime() - windowStart.getTime();
  const maxPosts = Math.floor(span / (q.minGapMinutes * 60 * 1000));
  const planned = ordered.slice(0, Math.max(1, maxPosts));
  const slot = span / planned.length;
  let last = 0;
  const jobs = planned.map((p, i) => {
    const earliest = Math.max(windowStart.getTime() + i * slot, last + q.minGapMinutes * 60 * 1000);
    const latest = Math.max(earliest, windowStart.getTime() + (i + 1) * slot - 60 * 1000);
    const at = earliest + Math.random() * (latest - earliest);
    last = at;
    return { day, ...p, scheduledAt: new Date(at), status: 'pending' as const };
  });
  await FacebookQueueJob.insertMany(jobs);
  console.info(`[queue] planned ${jobs.length} posts for ${day}`);
}

// ----- Serving the extension -----

const SITE_API = () => process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;

function imageUrls(images: string[]) {
  return images.slice(0, 10).flatMap((url) => {
    if (/^https:\/\/img\.yad2\.co\.il\//.test(url)) return [`${url.split('?')[0]}?w=1600&h=1600&c=9`];
    if (url.startsWith('/uploads/')) return [`${SITE_API()}${url}`];
    return [];
  });
}

/**
 * What the extension should do now: a post to publish, or when to ask again.
 * Hands out at most one post at a time and never catches up in a burst.
 */
export async function nextForExtension(now = new Date()) {
  const s = await getSiteSettingsDoc();
  const q = s.facebookQueue;
  q.extensionLastSeen = now;
  s.markModified('facebookQueue');
  await s.save();

  if (!q.enabled) return { state: 'off' as const };
  if (q.pausedUntil && q.pausedUntil > now) return { state: 'paused' as const, until: q.pausedUntil };

  await ensureTodayPlan(now);
  const day = israelDay(now);

  // Housekeeping: stale hand-outs, and posts whose day window has passed.
  await FacebookQueueJob.updateMany(
    { status: 'sent', sentAt: { $lt: new Date(now.getTime() - SENT_TIMEOUT_MS) } },
    { $set: { status: 'failed', doneAt: now, note: 'התוסף לא דיווח על תוצאה.' } }
  );
  const dayOver = now > israelHourToday(q.endHour, now);
  await FacebookQueueJob.updateMany(
    { status: 'pending', $or: [{ day: { $lt: day } }, ...(dayOver ? [{ day }] : [])] },
    { $set: { status: 'skipped', doneAt: now, note: 'לא בוצע בזמן (המחשב או כרום היו כבויים).' } }
  );

  if (await FacebookQueueJob.exists({ status: 'sent' })) return { state: 'busy' as const };

  // Respect the gap from the last post, manual ones included.
  const [lastJob, lastManual] = await Promise.all([
    FacebookQueueJob.findOne({ status: 'posted' }).sort({ doneAt: -1 }).select('doneAt').lean(),
    FacebookPost.findOne().sort({ postedAt: -1 }).select('postedAt').lean(),
  ]);
  const lastPostAt = Math.max(lastJob?.doneAt?.getTime() ?? 0, lastManual?.postedAt?.getTime() ?? 0);
  const gapUntil = lastPostAt + q.minGapMinutes * 60 * 1000;

  const due = await FacebookQueueJob.findOne({ day, status: 'pending', scheduledAt: { $lte: now } }).sort({
    scheduledAt: 1,
  });
  const nextPending = await FacebookQueueJob.findOne({ day, status: 'pending' }).sort({ scheduledAt: 1 }).lean();

  if (!due || gapUntil > now.getTime()) {
    const next = Math.max(nextPending?.scheduledAt.getTime() ?? 0, gapUntil);
    return nextPending ? { state: 'waiting' as const, next: new Date(next) } : { state: 'done_for_today' as const };
  }

  const [apartment, group] = await Promise.all([
    Apartment.findById(due.apartmentId).select('-embedding').lean(),
    FacebookGroup.findById(due.groupId).lean(),
  ]);
  if (!apartment || apartment.active === false || !group) {
    due.status = 'skipped';
    due.doneAt = now;
    due.note = 'הנכס או הקבוצה כבר לא קיימים.';
    await due.save();
    return { state: 'waiting' as const, next: now };
  }

  due.status = 'sent';
  due.sentAt = now;
  await due.save();

  const template = pickVariant(s.facebookTemplate, `${apartment._id}:${group._id}`);
  return {
    state: 'post' as const,
    job: {
      jobId: String(due._id),
      groupUrl: group.url,
      groupName: group.name,
      text: renderPost(template, apartment as any, {
        phone: s.contact?.phone,
        license: s.contact?.license,
        siteUrl: process.env.SITE_URL || 'http://localhost:5173',
      }),
      images: imageUrls(apartment.images?.length ? apartment.images : apartment.img ? [apartment.img] : []),
    },
  };
}

type ExtensionStatus = 'posted' | 'warning' | 'no_brokers' | 'error';

/** The extension's report on a post it was handed. */
export async function recordExtensionResult(jobId: string, status: ExtensionStatus, message?: string) {
  const job = await FacebookQueueJob.findById(jobId);
  if (!job || job.status !== 'sent') return;
  const now = new Date();
  const s = await getSiteSettingsDoc();
  const q = s.facebookQueue;
  const group = await FacebookGroup.findById(job.groupId).select('name').lean();
  const apartment = await Apartment.findById(job.apartmentId).select('street city').lean();
  const what = `${apartment?.street ?? ''}, ${apartment?.city ?? ''} בקבוצה ״${group?.name ?? ''}״`;

  job.doneAt = now;
  job.note = message?.slice(0, 500) ?? null;

  if (status === 'posted') {
    job.status = 'posted';
    q.consecutiveFailures = 0;
    await FacebookPost.updateOne(
      { apartmentId: job.apartmentId, groupId: job.groupId },
      { $set: { postedAt: now } },
      { upsert: true }
    );
  } else if (status === 'no_brokers') {
    job.status = 'skipped';
    job.note = 'הקבוצה מסומנת ״ללא תיווך״.';
  } else if (status === 'warning') {
    job.status = 'failed';
    q.pausedUntil = new Date(now.getTime() + WARNING_PAUSE_HOURS * 3600 * 1000);
    await alert(
      'פייסבוק הציגה אזהרה, הפרסום הושהה',
      `בזמן פרסום ${what} פייסבוק הציגה אזהרה או חסימה.\n${message ?? ''}\n\nהפרסום האוטומטי בקבוצות הושהה ל־${WARNING_PAUSE_HOURS} שעות. מומלץ לא לפרסם ידנית בזמן הזה.`
    );
  } else {
    job.status = 'failed';
    q.consecutiveFailures += 1;
    if (q.consecutiveFailures >= FAILURES_BEFORE_PAUSE) {
      q.pausedUntil = new Date(now.getTime() + FAILURE_PAUSE_HOURS * 3600 * 1000);
      q.consecutiveFailures = 0;
      await alert(
        'כמה פרסומים ברצף נכשלו, הפרסום הושהה',
        `${FAILURES_BEFORE_PAUSE} פרסומים אוטומטיים ברצף נכשלו. האחרון: ${what}.\n${message ?? ''}\n\nהפרסום הושהה ל־${FAILURE_PAUSE_HOURS} שעות. ייתכן שפייסבוק שינתה את מבנה הדף או שהחשבון לא מחובר.`
      );
    }
  }
  await job.save();
  s.markModified('facebookQueue');
  await s.save();
}

/** Rebuilds today's plan (drops what hasn't run yet). */
export async function replanToday() {
  await FacebookQueueJob.deleteMany({ day: israelDay(), status: 'pending' });
  await ensureTodayPlan(new Date(), { force: true });
}
