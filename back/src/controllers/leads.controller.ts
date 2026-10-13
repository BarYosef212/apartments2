import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Apartment } from '../models/Apartment.model';
import { Lead, LEAD_REASONS } from '../models/Lead.model';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import { isMailConfigured, sendMail } from '../services/mail.service';
import { LeadDocument, LeadReason } from '../types/models.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REASON_LABELS: Record<LeadReason, string> = {
  viewing: 'תיאום ביקור בנכס',
  valuation: 'הערכת נכס / שיווק נכס',
  general: 'פנייה כללית',
};

// Simple per-IP limit; enough for a small office site on one server.
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;
const recent = new Map<string, number[]>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > RATE_MAX;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function buildEmail(lead: LeadDocument) {
  const rows: [string, string][] = [
    ['סיבת הפנייה', REASON_LABELS[lead.reason]],
    ['שם', lead.name],
    ['טלפון', lead.phone],
    ['אימייל', lead.email || '—'],
  ];
  if (lead.apartment) {
    rows.push(['נכס', `${lead.apartment.street}, ${lead.apartment.city}`]);
  }
  if (lead.message) rows.push(['הודעה', lead.message]);

  const subject = `פנייה חדשה מהאתר: ${REASON_LABELS[lead.reason]} · ${lead.name}`.replace(/[\r\n]+/g, ' ');
  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    (lead.apartment ? `\n\nקישור לנכס: ${lead.apartment.url}` : '');
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#191917">
<h2 style="margin:0 0 16px">פנייה חדשה מהאתר</h2>
<table cellpadding="6" style="border-collapse:collapse">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="color:#625D55;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
  )
  .join('\n')}
</table>
${lead.apartment ? `<p><a href="${escapeHtml(lead.apartment.url)}">לצפייה בנכס באתר</a></p>` : ''}
</div>`;
  return { subject, text, html };
}

export class LeadsController {
  async handleCreate(req: Request, res: Response) {
    try {
      const body = req.body ?? {};

      // Honeypot: real visitors never see this field. Pretend it worked.
      if (body.website) return res.status(201).json({ ok: true });

      if (isRateLimited(req.ip ?? 'unknown')) {
        return res.status(429).json({ message: 'Too many requests' });
      }

      const name = String(body.name ?? '').trim();
      const phone = String(body.phone ?? '').trim();
      const email = String(body.email ?? '').trim();
      const message = String(body.message ?? '').trim();
      const reason: LeadReason = LEAD_REASONS.includes(body.reason) ? body.reason : 'general';
      const digits = phone.replace(/\D/g, '');

      if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Invalid name' });
      if (digits.length < 9 || digits.length > 15 || phone.length > 30) {
        return res.status(400).json({ message: 'Invalid phone' });
      }
      if (email && (email.length > 120 || !EMAIL_RE.test(email))) {
        return res.status(400).json({ message: 'Invalid email' });
      }
      if (message.length > 2000) return res.status(400).json({ message: 'Message is too long' });

      let apartment = null;
      if (body.apartmentId && mongoose.isValidObjectId(body.apartmentId)) {
        const a = await Apartment.findById(body.apartmentId).select('street city').lean();
        if (a) {
          // Never from the request: a sender could point the link anywhere.
          const origin = process.env.SITE_URL || 'http://localhost:5173';
          apartment = { id: String(a._id), street: a.street, city: a.city, url: `${origin}/apartments/${a._id}` };
        }
      }

      const settings = await getSiteSettingsDoc();
      const to = settings.contact.leadsEmail || settings.contact.email;

      // Save first, so a lead is never lost to a mail failure.
      const lead = await Lead.create({
        name,
        phone,
        email,
        reason,
        message,
        apartment,
        emailStatus: to && isMailConfigured() ? 'sent' : 'not_configured',
      });

      if (lead.emailStatus === 'sent') {
        try {
          await sendMail({ to, ...buildEmail(lead), replyTo: email || undefined });
        } catch (err) {
          console.error('[leads] email failed:', (err as Error).message);
          lead.emailStatus = 'failed';
          lead.emailError = (err as Error).message;
          await lead.save();
        }
      } else {
        console.warn('[leads] email not sent: no leads email or SMTP settings');
      }

      return res.status(201).json({ ok: true });
    } catch (error) {
      console.error('Error creating lead', error);
      return res.status(500).json({ message: 'Error creating lead' });
    }
  }

  async handleList(req: Request, res: Response) {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
      const leads = await Lead.find().sort({ createdAt: -1 }).limit(limit).lean();
      return res.json(leads);
    } catch (error) {
      console.error('Error fetching leads', error);
      return res.status(500).json({ message: 'Error fetching leads' });
    }
  }
}
