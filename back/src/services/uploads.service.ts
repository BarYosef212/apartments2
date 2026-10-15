import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';

export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'));
export const UPLOADS_URL_PREFIX = '/uploads/';

const MAX_FILE_BYTES = 100 * 1024 * 1024;

const ALLOWED: Record<string, { kind: 'image' | 'video'; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: '.jpg' },
  'image/png': { kind: 'image', ext: '.png' },
  'image/webp': { kind: 'image', ext: '.webp' },
  'video/mp4': { kind: 'video', ext: '.mp4' },
  'video/webm': { kind: 'video', ext: '.webm' },
  'video/quicktime': { kind: 'video', ext: '.mov' },
};

export const mediaKindOf = (mimetype: string) => ALLOWED[mimetype]?.kind;

export const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        cb(null, UPLOADS_DIR);
      } catch (err) {
        cb(err as Error, UPLOADS_DIR);
      }
    },
    // Random name, extension from the allowed type: never from the client's
    // file name, or an "image" named .html would be served as a page.
    filename: (_req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${ALLOWED[file.mimetype].ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, !!mediaKindOf(file.mimetype)),
});

/** Removes a file we uploaded earlier; ignores external URLs and missing files. */
export async function removeUpload(url: string | undefined) {
  if (!url || !url.startsWith(UPLOADS_URL_PREFIX)) return;
  const name = path.basename(url);
  await fs.unlink(path.join(UPLOADS_DIR, name)).catch(() => undefined);
}
