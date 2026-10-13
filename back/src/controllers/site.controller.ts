import { Request, Response } from 'express';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import { mediaKindOf, removeUpload, UPLOADS_URL_PREFIX } from '../services/uploads.service';

const CONTACT_FIELDS = ['phone', 'whatsapp', 'email', 'address', 'license'] as const;
const TEXT_FIELDS = ['heroEyebrow', 'heroTitle', 'heroSubtitle', 'ownersTitle', 'ownersText'] as const;
const MAX_TEXT = 400;

/** Media must be one of our uploads or an https URL; '' clears it. */
function validMediaUrl(value: string) {
  return value === '' || value.startsWith(UPLOADS_URL_PREFIX) || /^https:\/\//.test(value);
}

function toPublic(s: Awaited<ReturnType<typeof getSiteSettingsDoc>>) {
  return {
    heroMedia: s.heroMedia,
    ownersImage: s.ownersImage,
    texts: s.texts,
    contact: s.contact,
  };
}

export class SiteController {
  async handleGet(req: Request, res: Response) {
    try {
      return res.json(toPublic(await getSiteSettingsDoc()));
    } catch (error) {
      console.error('Error fetching site settings', error);
      return res.status(500).json({ message: 'Error fetching site settings' });
    }
  }

  async handleUpdate(req: Request, res: Response) {
    try {
      const { heroMedia, ownersImage, texts, contact } = req.body ?? {};
      const s = await getSiteSettingsDoc();
      const replaced: string[] = [];

      if (heroMedia !== undefined) {
        const url = String(heroMedia?.url ?? '').trim();
        const kind = heroMedia?.kind === 'video' ? 'video' : 'image';
        if (!validMediaUrl(url)) return res.status(400).json({ message: 'Invalid media URL' });
        if (s.heroMedia.url !== url) replaced.push(s.heroMedia.url);
        s.heroMedia = { kind, url };
      }

      if (ownersImage !== undefined) {
        const url = String(ownersImage).trim();
        if (!validMediaUrl(url)) return res.status(400).json({ message: 'Invalid media URL' });
        if (s.ownersImage !== url) replaced.push(s.ownersImage);
        s.ownersImage = url;
      }

      if (texts !== undefined) {
        for (const field of TEXT_FIELDS) {
          if (texts[field] === undefined) continue;
          const value = String(texts[field]).trim();
          if (value.length > MAX_TEXT) return res.status(400).json({ message: 'Text is too long' });
          s.texts[field] = value;
        }
        s.markModified('texts');
      }

      if (contact !== undefined) {
        for (const field of CONTACT_FIELDS) {
          if (contact[field] === undefined) continue;
          const value = String(contact[field]).trim();
          if (value.length > 200) return res.status(400).json({ message: 'Text is too long' });
          s.contact[field] = value;
        }
        if (s.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.contact.email)) {
          return res.status(400).json({ message: 'Invalid email' });
        }
        s.markModified('contact');
      }

      await s.save();
      await Promise.all(replaced.map(removeUpload));
      return res.json(toPublic(s));
    } catch (error) {
      console.error('Error updating site settings', error);
      return res.status(500).json({ message: 'Error updating site settings' });
    }
  }

  async handleUpload(req: Request, res: Response) {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Unsupported or missing file' });
    return res.status(201).json({
      url: `${UPLOADS_URL_PREFIX}${file.filename}`,
      kind: mediaKindOf(file.mimetype),
    });
  }
}
