import { Request, Response } from 'express';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import { mediaKindOf, removeUpload, UPLOADS_URL_PREFIX } from '../services/uploads.service';
import { encryptSecret } from '../services/secrets.service';
import { isMailConfigured, sendMail } from '../services/mail.service';

const CONTACT_FIELDS = ['phone', 'whatsapp', 'email', 'address', 'license', 'leadsEmail'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXT_FIELDS = ['heroEyebrow', 'heroTitle', 'heroSubtitle', 'ownersTitle', 'ownersText'] as const;
const MAX_TEXT = 400;

/** Media must be one of our uploads or an https URL; '' clears it. */
function validMediaUrl(value: string) {
  return value === '' || value.startsWith(UPLOADS_URL_PREFIX) || /^https:\/\//.test(value);
}

type SettingsDoc = Awaited<ReturnType<typeof getSiteSettingsDoc>>;

function toAdmin(s: SettingsDoc) {
  const { host, port, user, from, passEncrypted } = s.smtp;
  return {
    heroMedia: s.heroMedia,
    ownersImage: s.ownersImage,
    texts: s.texts,
    contact: s.contact,
    // The password never leaves the server; the admin only learns it is set.
    smtp: { host, port, user, from, hasPassword: !!passEncrypted },
  };
}

/** What anyone may see: everything except where forms are delivered. */
function toPublic(s: SettingsDoc) {
  const { phone, whatsapp, email, address, license } = s.contact;
  return {
    heroMedia: s.heroMedia,
    ownersImage: s.ownersImage,
    texts: s.texts,
    contact: { phone, whatsapp, email, address, license },
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

  async handleGetAdmin(req: Request, res: Response) {
    try {
      return res.json(toAdmin(await getSiteSettingsDoc()));
    } catch (error) {
      console.error('Error fetching site settings', error);
      return res.status(500).json({ message: 'Error fetching site settings' });
    }
  }

  async handleUpdate(req: Request, res: Response) {
    try {
      const { heroMedia, ownersImage, texts, contact, smtp } = req.body ?? {};
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
        if (
          (s.contact.email && !EMAIL_RE.test(s.contact.email)) ||
          (s.contact.leadsEmail && !EMAIL_RE.test(s.contact.leadsEmail))
        ) {
          return res.status(400).json({ message: 'Invalid email' });
        }
        s.markModified('contact');
      }

      if (smtp !== undefined) {
        const host = String(smtp.host ?? s.smtp.host).trim();
        const user = String(smtp.user ?? s.smtp.user).trim();
        const from = String(smtp.from ?? s.smtp.from).trim();
        const port = Number(smtp.port ?? s.smtp.port);
        if (host && !/^[a-z0-9.-]+$/i.test(host)) return res.status(400).json({ message: 'Invalid SMTP host' });
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          return res.status(400).json({ message: 'Invalid SMTP port' });
        }
        if ([host, user, from].some((v) => v.length > 200)) {
          return res.status(400).json({ message: 'Text is too long' });
        }
        s.smtp.host = host;
        s.smtp.port = port;
        s.smtp.user = user;
        s.smtp.from = from;
        // Empty or missing password = keep the stored one.
        if (typeof smtp.pass === 'string' && smtp.pass.length > 0) {
          if (smtp.pass.length > 500) return res.status(400).json({ message: 'Text is too long' });
          s.smtp.passEncrypted = encryptSecret(smtp.pass);
        }
        s.markModified('smtp');
      }

      await s.save();
      await Promise.all(replaced.map(removeUpload));
      return res.json(toAdmin(s));
    } catch (error) {
      console.error('Error updating site settings', error);
      return res.status(500).json({ message: 'Error updating site settings' });
    }
  }

  async handleTestMail(req: Request, res: Response) {
    try {
      const s = await getSiteSettingsDoc();
      const to = s.contact.leadsEmail || s.contact.email;
      if (!to) return res.status(400).json({ message: 'No leads email' });
      if (!(await isMailConfigured())) return res.status(400).json({ message: 'Mail is not configured' });
      await sendMail({
        to,
        subject: 'בדיקת שליחת מיילים מהאתר',
        text: 'אם קיבלתם את המייל הזה, טפסים מהאתר יישלחו לכתובת הזו.',
        html: '<div dir="rtl" style="font-family:Arial,sans-serif">אם קיבלתם את המייל הזה, טפסים מהאתר יישלחו לכתובת הזו.</div>',
      });
      return res.json({ ok: true, to });
    } catch (error) {
      console.error('Test mail failed', error);
      // The mail server's own reason helps the admin fix the settings.
      return res.status(502).json({ message: 'Send failed', detail: (error as Error).message });
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
