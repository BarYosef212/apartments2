import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Apartment } from '../models/Apartment.model';
import { FacebookGroup, FacebookQueueJob } from '../models/Facebook.model';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import {
  ensureTodayPlan,
  israelDay,
  issueExtensionKey,
  nextForExtension,
  QUEUE_BOUNDS,
  recordExtensionResult,
  replanToday,
  verifyExtensionKey,
} from '../services/facebookQueue.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONLINE_MS = 3 * 60 * 1000;

function view(q: any) {
  return {
    enabled: q.enabled,
    postsPerDay: q.postsPerDay,
    groupsPerListing: q.groupsPerListing,
    startHour: q.startHour,
    endHour: q.endHour,
    minGapMinutes: q.minGapMinutes,
    repostDays: q.repostDays,
    alertEmail: q.alertEmail,
    pausedUntil: q.pausedUntil,
    extensionConnected: !!q.extensionKeyHash,
    extensionOnline: !!q.extensionLastSeen && Date.now() - new Date(q.extensionLastSeen).getTime() < ONLINE_MS,
    extensionLastSeen: q.extensionLastSeen,
    bounds: QUEUE_BOUNDS,
  };
}

/** Lets only the extension holding the current key through. */
export async function requireExtensionKey(req: Request, res: Response, next: NextFunction) {
  if (await verifyExtensionKey(req.get('x-extension-key'))) return next();
  return res.status(401).json({ message: 'Invalid extension key' });
}

export class FacebookQueueController {
  // ----- Admin -----

  async getSettings(req: Request, res: Response) {
    const s = await getSiteSettingsDoc();
    return res.json(view(s.facebookQueue));
  }

  async saveSettings(req: Request, res: Response) {
    const body = req.body ?? {};
    const s = await getSiteSettingsDoc();
    const q = s.facebookQueue;
    for (const [key, [min, max]] of Object.entries(QUEUE_BOUNDS)) {
      if (body[key] === undefined) continue;
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < min || n > max) {
        return res.status(400).json({ message: 'Out of range', field: key });
      }
      (q as any)[key] = n;
    }
    if (q.endHour <= q.startHour) return res.status(400).json({ message: 'Out of range', field: 'endHour' });
    if (body.alertEmail !== undefined) {
      const email = String(body.alertEmail).trim();
      if (email && !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Invalid email' });
      q.alertEmail = email;
    }
    if (body.enabled !== undefined) {
      if (body.enabled === true && !q.extensionKeyHash) {
        return res.status(400).json({ message: 'Extension not connected' });
      }
      q.enabled = body.enabled === true;
    }
    s.markModified('facebookQueue');
    await s.save();
    return res.json(view(q));
  }

  async resume(req: Request, res: Response) {
    const s = await getSiteSettingsDoc();
    s.facebookQueue.pausedUntil = null;
    s.facebookQueue.consecutiveFailures = 0;
    s.markModified('facebookQueue');
    await s.save();
    return res.json(view(s.facebookQueue));
  }

  /** A fresh key for the extension (shown once, sent to it by the admin page). */
  async issueKey(req: Request, res: Response) {
    const key = await issueExtensionKey();
    const apiBase = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    return res.json({ key, apiBase });
  }

  async today(req: Request, res: Response) {
    await ensureTodayPlan();
    const jobs = await FacebookQueueJob.find({ day: israelDay() }).sort({ scheduledAt: 1 }).lean();
    const [apartments, groups] = await Promise.all([
      Apartment.find({ _id: { $in: jobs.map((j) => j.apartmentId) } }).select('street city').lean(),
      FacebookGroup.find({ _id: { $in: jobs.map((j) => j.groupId) } }).select('name').lean(),
    ]);
    const aById = new Map(apartments.map((a) => [String(a._id), a]));
    const gById = new Map(groups.map((g) => [String(g._id), g]));
    return res.json(
      jobs.map((j) => ({
        _id: j._id,
        scheduledAt: j.scheduledAt,
        status: j.status,
        doneAt: j.doneAt,
        note: j.note,
        apartment: aById.get(String(j.apartmentId)) ?? null,
        group: gById.get(String(j.groupId)) ?? null,
      }))
    );
  }

  async replan(req: Request, res: Response) {
    await replanToday();
    return this.today(req, res);
  }

  // ----- Extension -----

  async next(req: Request, res: Response) {
    return res.json(await nextForExtension());
  }

  async result(req: Request, res: Response) {
    const { id } = req.params;
    const { status, message } = req.body ?? {};
    if (!mongoose.isValidObjectId(id) || !['posted', 'warning', 'no_brokers', 'error'].includes(status)) {
      return res.status(400).json({ message: 'Invalid result' });
    }
    await recordExtensionResult(id, status, typeof message === 'string' ? message : undefined);
    return res.json({ ok: true });
  }
}
