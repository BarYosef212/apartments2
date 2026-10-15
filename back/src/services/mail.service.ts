import nodemailer from 'nodemailer';
import { getSiteSettingsDoc } from '../models/SiteSettings.model';
import { decryptSecret } from './secrets.service';

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * SMTP settings from the admin (site settings), or else from the environment
 * (see .env.example). Null when neither is complete.
 */
async function getMailConfig(): Promise<MailConfig | null> {
  const { smtp } = await getSiteSettingsDoc();
  if (smtp?.host && smtp.user && smtp.passEncrypted) {
    return {
      host: smtp.host,
      port: smtp.port || 465,
      user: smtp.user,
      pass: decryptSecret(smtp.passEncrypted),
      from: smtp.from || smtp.user,
    };
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return {
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      user: SMTP_USER,
      pass: SMTP_PASS,
      from: MAIL_FROM || SMTP_USER,
    };
  }
  return null;
}

export async function isMailConfigured() {
  return (await getMailConfig()) !== null;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const config = await getMailConfig();
  if (!config) throw new Error('Mail is not configured');
  // Built per message: volume is tiny and settings can change from the admin.
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15000,
  });
  await transporter.sendMail({ from: config.from, ...options });
}
