// Generates the home page hero video with Google Veo, using your own API key.
//
// Usage (from back/): put GEMINI_API_KEY=your-key in back/.env, then
//   node scripts/generate-hero-video.mjs
// Optional: VEO_MODEL=veo-3.1-fast-generate-preview (sharper, costs more)
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

const PROMPT =
  'Slow cinematic dolly shot gliding through a modern luxury living room in warm golden evening light. ' +
  'Floor-to-ceiling windows overlook a Mediterranean city skyline at sunset. Neutral palette of warm stone, ' +
  'travertine, oak wood and cream fabrics, minimal designer furniture, soft shadows. Calm, steady, smooth ' +
  'camera movement, architectural real estate film, photorealistic, high detail. Empty room with no people, ' +
  'no text, no logos.';

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
  console.log(`Requesting an 8-second 16:9 video from ${MODEL}…`);
  const op = await call(`${API}/models/${MODEL}:predictLongRunning`, {
    method: 'POST',
    body: JSON.stringify({
      instances: [{ prompt: PROMPT }],
      parameters: { aspectRatio: '16:9', durationSeconds: 8 },
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
