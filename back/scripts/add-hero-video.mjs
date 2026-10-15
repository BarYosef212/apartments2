// Compresses a video and adds it to the home page hero sequence.
//
// Usage (from back/):
//   node scripts/add-hero-video.mjs hero-video-garden.mp4          adds it at the end
//   node scripts/add-hero-video.mjs hero-video-balcony.mp4 --first replaces the first video
//
// Nothing already in the sequence is removed, except the old first video
// when --first is used. Needs ffmpeg (brew install ffmpeg) and MONGO_URI in .env.

import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const BACK = new URL('..', import.meta.url).pathname;
dotenv.config({ path: path.join(BACK, '.env'), quiet: true });

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(BACK, 'uploads'));
const MAX_CLIPS = 5;

const [input, flag] = process.argv.slice(2);
const asFirst = flag === '--first';

function fail(message) {
  console.error('Failed:', message);
  process.exit(1);
}

if (!input) fail('give the video file, e.g. node scripts/add-hero-video.mjs hero-video-garden.mp4');
const source = path.resolve(BACK, input);
if (!fs.existsSync(source)) fail(`no such file: ${source}`);
if (!process.env.MONGO_URI) fail('MONGO_URI is not set in .env');

// A background video needs no sound, and ~4 Mbps H.264 looks the same under
// the hero's dark overlay at a fraction of the size.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const name = `${crypto.randomUUID()}.mp4`;
const target = path.join(UPLOADS_DIR, name);
console.log('Compressing…');
try {
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-i', source,
      '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
      '-maxrate', '5M', '-bufsize', '10M',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      target,
    ],
    { stdio: 'inherit' }
  );
} catch {
  fail('ffmpeg failed (is it installed? brew install ffmpeg)');
}
const before = fs.statSync(source).size / 1e6;
const after = fs.statSync(target).size / 1e6;
console.log(`Compressed ${before.toFixed(1)}MB → ${after.toFixed(1)}MB`);

const url = `/uploads/${name}`;
await mongoose.connect(process.env.MONGO_URI);
const settings = mongoose.connection.db.collection('site_settings');
const doc = await settings.findOne();
const hero = doc?.heroMedia ?? {};
const current = hero.kind === 'video' && hero.url ? [hero.url, ...(hero.more ?? [])] : [];

let clips;
let removed = [];
if (asFirst || current.length === 0) {
  clips = [url, ...current.slice(1)];
  removed = current.slice(0, 1);
} else {
  if (current.length >= MAX_CLIPS) {
    fs.unlinkSync(target);
    await mongoose.disconnect();
    fail(`the sequence already has ${MAX_CLIPS} videos; remove one in the admin first`);
  }
  clips = [...current, url];
}

await settings.updateOne(
  { _id: doc?._id ?? new mongoose.Types.ObjectId() },
  { $set: { heroMedia: { kind: 'video', url: clips[0], more: clips.slice(1) } } },
  { upsert: true }
);
for (const old of removed) {
  if (old.startsWith('/uploads/')) fs.rmSync(path.join(UPLOADS_DIR, path.basename(old)), { force: true });
}
await mongoose.disconnect();

console.log(`Hero sequence now has ${clips.length} video(s); this one is #${clips.indexOf(url) + 1}.`);
