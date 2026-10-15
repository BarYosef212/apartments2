import { checkAllowed, getState, pause, recordFill } from './limits.js';

const GROUP_URL = /^https:\/\/www\.facebook\.com\/groups\/[^\s]+$/;
const IMAGE_URL = /^(https:\/\/img\.yad2\.co\.il\/|http:\/\/localhost:4000\/uploads\/)/;
const MAX_IMAGES = 10;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const humanPause = () => wait(2000 + Math.random() * 3000);

// Jobs survive the service worker going to sleep.
async function saveJob(job) {
  await chrome.storage.session.set({ [`job:${job.jobId}`]: job });
}
async function getJob(jobId) {
  return (await chrome.storage.session.get(`job:${jobId}`))[`job:${jobId}`];
}

/** Tells the admin page (through its bridge script) how the job went. */
async function report(job, result) {
  try {
    await chrome.tabs.sendMessage(job.adminTabId, { type: 'RESULT', jobId: job.jobId, ...result });
  } catch {
    // The admin tab was closed; nothing to tell.
  }
}

async function toDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function startJob(job) {
  const blocked = await checkAllowed();
  if (blocked) return { status: 'limit', ...blocked };

  const urls = job.images.filter((u) => IMAGE_URL.test(u)).slice(0, MAX_IMAGES);
  const images = [];
  for (const url of urls) {
    try {
      images.push(await toDataUrl(url));
    } catch {
      // A missing photo shouldn't stop the post.
    }
  }

  // Counted when the fill starts, even if it isn't posted: the safer side.
  await recordFill();
  const tab = await chrome.tabs.create({ url: job.groupUrl, active: true });
  await saveJob({ ...job, tabId: tab.id });
  await waitForTabComplete(tab.id);
  await humanPause();

  try {
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL',
      jobId: job.jobId,
      text: job.text,
      images,
    });
    await report(job, result);
  } catch (err) {
    await report(job, { status: 'error', message: 'הדף של הקבוצה לא הגיב. נסו שוב.' });
  }
  return { status: 'started' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'PING') {
      const { settings, count, nextAllowedAt, pausedUntil } = await getState();
      return { status: 'ready', version: chrome.runtime.getManifest().version, settings, count, nextAllowedAt, pausedUntil };
    }

    if (message?.type === 'FILL_GROUP') {
      const { jobId, groupUrl, text, images } = message;
      if (!jobId || !GROUP_URL.test(groupUrl || '') || typeof text !== 'string' || !Array.isArray(images)) {
        return { status: 'error', message: 'בקשה לא תקינה.' };
      }
      const job = { jobId, groupUrl, text, images, adminTabId: sender.tab?.id };
      await saveJob(job);
      // Reply right away; progress is reported to the admin tab as it happens.
      startJob(job).then((r) => r.status !== 'started' && report(job, r));
      return { status: 'accepted' };
    }

    // From the Facebook tab.
    if (message?.type === 'POSTED' || message?.type === 'WARNING' || message?.type === 'SKIPPED') {
      const job = await getJob(message.jobId);
      if (!job) return { ok: false };
      if (message.type === 'WARNING') await pause(48);
      await report(job, {
        status: message.type === 'POSTED' ? 'posted' : message.type === 'WARNING' ? 'warning' : 'skipped',
        message: message.message,
      });
      return { ok: true };
    }

    return { status: 'error', message: 'unknown message' };
  })().then(sendResponse);
  return true; // async response
});
