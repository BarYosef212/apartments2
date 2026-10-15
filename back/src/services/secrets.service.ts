import crypto from 'crypto';

// Encrypts secrets stored in the DB (e.g. the SMTP password), so a database
// dump alone doesn't reveal them. The key comes from the environment.
function key() {
  const secret = process.env.SETTINGS_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('SETTINGS_SECRET (or JWT_SECRET) must be set to store secrets');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
