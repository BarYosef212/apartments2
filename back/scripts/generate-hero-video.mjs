// Generates the home page hero video with Google Veo, using your own API key.
//
// Usage (from back/): put GEMINI_API_KEY=your-key in back/.env, then
//   node scripts/generate-hero-video.mjs
// Optional:
//   VIDEO_SCENE=villa | penthouse | livingroom (default)
//   VEO_MODEL=veo-3.1-generate-preview (best, 1080p) or
//             veo-3.1-fast-generate-preview (1080p, cheaper); default is Lite, 720p
//
// The key is read from back/.env (not committed) or the environment, and is
// never printed or written anywhere.
// The video is saved to back/hero-video.mp4; upload it in the admin under
// Site settings, or ask Claude to set it.

import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.VEO_MODEL || 'veo-3.1-lite-generate-preview';
const OUT = new URL('../hero-video.mp4', import.meta.url);
const API = 'https://generativelanguage.googleapis.com/v1beta';

// Scenes to choose from with VIDEO_SCENE=<name>. Mood footage for the hero,
// not any real listing.
const SCENES = {
  livingroom:
    'Slow cinematic dolly shot gliding through a modern luxury living room in warm golden evening light. ' +
    'Floor-to-ceiling windows overlook a Mediterranean city skyline at sunset. Neutral palette of warm stone, ' +
    'travertine, oak wood and cream fabrics, minimal designer furniture, soft shadows.',
  villa:
    'Slow aerial drone shot descending toward a modern minimalist luxury villa on a hillside above the ' +
    'Mediterranean Sea at golden hour. White stone walls, large glass facades, a long infinity pool reflecting ' +
    'the warm sunset sky, olive trees and landscaped terraces, soft long shadows, calm turquoise sea.',
  penthouse:
    'Slow cinematic push-in through open floor-to-ceiling glass doors onto a luxury penthouse terrace at blue ' +
    'hour, overlooking a Mediterranean coastal city skyline with warm city lights and the sea at the horizon. ' +
    'Travertine floor, sculptural outdoor furniture, olive tree in a stone planter, soft warm interior glow.',
};
const STYLE =
  ' Smooth, steady, slow camera movement, high-end architectural real estate film, photorealistic, ' +
  'natural light, rich detail, shallow depth of field. No people, no text, no logos, no watermark.';

const SCENE = process.env.VIDEO_SCENE || 'livingroom';
if (!SCENES[SCENE]) {
  console.error(`Unknown VIDEO_SCENE "${SCENE}". Choose one of: ${Object.keys(SCENES).join(', ')}`);
  process.exit(1);
}
const PROMPT = SCENES[SCENE] + STYLE;
// Lite only renders 720p; the full and fast models can do 1080p.
const RESOLUTION = MODEL.includes('lite') ? undefined : '1080p';

if (!KEY) {
  console.error('Add a line GEMINI_API_KEY=your-key to back/.env, save, and run again.');
  process.exit(1);
}

const headers = { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(url, init) {
  const res = await fetch(url, { headers, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
  return body;
}

try {
  console.log(`Requesting an 8-second 16:9 ${RESOLUTION ?? '720p'} "${SCENE}" video from ${MODEL}…`);
  const op = await call(`${API}/models/${MODEL}:predictLongRunning`, {
    method: 'POST',
    body: JSON.stringify({
      instances: [{ prompt: PROMPT }],
      parameters: { aspectRatio: '16:9', durationSeconds: 8, ...(RESOLUTION && { resolution: RESOLUTION }) },
    }),
  });

  // Generation usually takes 1–5 minutes.
  let status = op;
  for (let i = 0; !status.done; i++) {
    if (i > 60) throw new Error('Still not ready after 15 minutes; try again later.');
    process.stdout.write('.');
    await sleep(15000);
    status = await call(`${API}/${op.name}`);
  }
  console.log();
  if (status.error) throw new Error(status.error.message);

  const uri = status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) throw new Error(`No video returned (it may have been filtered): ${JSON.stringify(status.response)}`);

  const video = await fetch(uri, { headers: { 'x-goog-api-key': KEY }, redirect: 'follow' });
  if (!video.ok) throw new Error(`Download failed: ${video.status}`);
  fs.writeFileSync(OUT, Buffer.from(await video.arrayBuffer()));
  console.log(`Saved ${OUT.pathname}`);
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
}
