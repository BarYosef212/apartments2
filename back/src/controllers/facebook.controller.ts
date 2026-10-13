import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import mongoose from 'mongoose';
import { Apartment } from '../models/Apartment.model';
import { FacebookGroup, FacebookPost } from '../models/Facebook.model';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from '../services/uploads.service';

const FACEBOOK_GROUP_RE = /^https:\/\/(www\.|m\.|web\.)?facebook\.com\/groups\/[^\s]+$/i;
const MAX_ZIP_IMAGES = 20;
const MAX_TEMPLATE = 3000;

const badId = (...ids: unknown[]) => ids.some((id) => !mongoose.isValidObjectId(id));

/** Full-size image bytes: our own uploads from disk, Yad2 photos from its CDN at 1600px. */
async function loadImage(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith(UPLOADS_URL_PREFIX)) {
      return await fs.readFile(path.join(UPLOADS_DIR, path.basename(url)));
    }
    if (!/^https:\/\/img\.yad2\.co\.il\//.test(url)) return null;
    const res = await fetch(`${url.split('?')[0]}?w=1600&h=1600&c=9`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export class FacebookController {
  async listGroups(req: Request, res: Response) {
    return res.json(await FacebookGroup.find().sort({ createdAt: 1 }).lean());
  }

  async addGroup(req: Request, res: Response) {
    const name = String(req.body?.name ?? '').trim();
    const url = String(req.body?.url ?? '').trim();
    if (!name || name.length > 100) return res.status(400).json({ message: 'Invalid name' });
    if (!FACEBOOK_GROUP_RE.test(url) || url.length > 500) {
      return res.status(400).json({ message: 'Invalid group URL' });
    }
    const group = await FacebookGroup.create({ name, url });
    return res.status(201).json(group.toObject());
  }

  async deleteGroup(req: Request, res: Response) {
    if (badId(req.params.id)) return res.status(404).json({ message: 'Not found' });
    await FacebookGroup.deleteOne({ _id: req.params.id });
    await FacebookPost.deleteMany({ groupId: req.params.id });
    return res.status(204).end();
  }

  async getTemplate(req: Request, res: Response) {
    const s = await getSiteSettingsDoc();
    return res.json({ template: s.facebookTemplate });
  }

  async saveTemplate(req: Request, res: Response) {
    const template = String(req.body?.template ?? '');
    if (!template.trim() || template.length > MAX_TEMPLATE) {
      return res.status(400).json({ message: 'Invalid template' });
    }
    const s = await getSiteSettingsDoc();
    s.facebookTemplate = template;
    await s.save();
    return res.json({ template: s.facebookTemplate });
  }

  async listPosts(req: Request, res: Response) {
    return res.json(await FacebookPost.find().select('apartmentId groupId postedAt').lean());
  }

  async markPosted(req: Request, res: Response) {
    const { apartmentId, groupId } = req.body ?? {};
    if (badId(apartmentId, groupId)) return res.status(400).json({ message: 'Invalid ids' });
    const post = await FacebookPost.findOneAndUpdate(
      { apartmentId, groupId },
      { $set: { postedAt: new Date() } },
      { upsert: true, new: true }
    ).lean();
    return res.json(post);
  }

  async unmarkPosted(req: Request, res: Response) {
    const { apartmentId, groupId } = req.body ?? {};
    if (badId(apartmentId, groupId)) return res.status(400).json({ message: 'Invalid ids' });
    await FacebookPost.deleteOne({ apartmentId, groupId });
    return res.status(204).end();
  }

  /** A zip of the listing's photos, ready to attach to a Facebook post. */
  async downloadImages(req: Request, res: Response) {
    try {
      if (badId(req.params.id)) return res.status(404).json({ message: 'Not found' });
      const apartment = await Apartment.findById(req.params.id).select('images img street').lean();
      if (!apartment) return res.status(404).json({ message: 'Not found' });

      const urls = (apartment.images?.length ? apartment.images : [apartment.img])
        .filter((u): u is string => !!u)
        .slice(0, MAX_ZIP_IMAGES);
      const images = await Promise.all(urls.map(loadImage));

      const zip = new JSZip();
      images.forEach((data, i) => {
        if (data) zip.file(`${String(i + 1).padStart(2, '0')}.jpg`, data);
      });
      if (Object.keys(zip.files).length === 0) return res.status(404).json({ message: 'No images' });

      const body = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="listing-${apartment._id}.zip"`);
      return res.send(body);
    } catch (error) {
      console.error('Error zipping images', error);
      return res.status(500).json({ message: 'Error zipping images' });
    }
  }
}
