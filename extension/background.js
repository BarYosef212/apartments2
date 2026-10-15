import { checkAllowed, getState, pause, recordFill, undoFill } from './limits.js';

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
  const undo = await recordFill();
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
    // Nothing went into a post: don't count it against the limits.
    if (result?.status !== 'filled') await undoFill(undo);
    await report(job, result);
  } catch (err) {
    await undoFill(undo);
    await report(job, { status: 'error', message: 'הדף של הקבוצה לא הגיב. נסו שוב.' });
  }
  return { status: 'started' };
}

// ----- Automatic queue -----
// Once a minute, ask the site's server whether a post is due. The server
// plans the day and enforces the pace; the limits here (daily cap shared with
// manual posts, Facebook-warning pause) apply on top.

const QUEUE_ALARM = 'queue';
// Where the queue's server may live (also needs host_permissions in manifest).
const API_BASE = /^(http:\/\/localhost:4000|https:\/\/[a-z0-9.-]+)$/i;

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 1 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 1 }));
chrome.alarms.onAlarm.addListener((alarm) => alarm.name === QUEUE_ALARM && queueTick());

async function queueConfig() {
  return (await chrome.storage.local.get('queueConfig')).queueConfig;
}

async function queueFetch(config, path, body) {
  const res = await fetch(`${config.apiBase}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-extension-key': config.key, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`server ${res.status}`);
  return res.json();
}

async function queueTick() {
  const config = await queueConfig();
  if (!config) return;
  // One automatic post at a time, even if the worker wakes twice.
  const { queueBusyUntil = 0 } = await chrome.storage.session.get('queueBusyUntil');
  if (queueBusyUntil > Date.now()) return;
  if (await checkAllowed()) return; // local cap reached, too soon after a manual post, or paused

  let next;
  try {
    next = await queueFetch(config, '/extension/queue/next');
  } catch {
    return; // server unreachable; try again next minute
  }
  if (next.state !== 'post') return;

  await chrome.storage.session.set({ queueBusyUntil: Date.now() + 10 * 60 * 1000 });
  try {
    const result = await runAutoPost(next.job);
    await queueFetch(config, `/extension/queue/jobs/${next.job.jobId}/result`, result).catch(() => {});
  } finally {
    await chrome.storage.session.set({ queueBusyUntil: 0 });
  }
}

/** Opens the group in its own unfocused window, posts, and closes it. */
async function runAutoPost(job) {
  if (!GROUP_URL.test(job.groupUrl || '')) return { status: 'error', message: 'קישור קבוצה לא תקין.' };
  const images = [];
  for (const url of (job.images || []).filter((u) => IMAGE_URL.test(u)).slice(0, MAX_IMAGES)) {
    try {
      images.push(await toDataUrl(url));
    } catch {
      // A missing photo shouldn't stop the post.
    }
  }

  const undo = await recordFill();
  const win = await chrome.windows.create({ url: job.groupUrl, focused: false, width: 1200, height: 900 });
  const tabId = win.tabs[0].id;
  try {
    await waitForTabComplete(tabId);
    await humanPause();
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'FILL',
      jobId: job.jobId,
      text: job.text,
      images,
      autoPost: true,
    });
    if (result?.status !== 'posted') await undoFill(undo);
    if (result?.status === 'warning') await pause(48);
    return { status: result?.status === 'filled' ? 'error' : result?.status || 'error', message: result?.message };
  } catch (err) {
    await undoFill(undo);
    return { status: 'error', message: 'דף הקבוצה לא הגיב.' };
  } finally {
    // Leave it on screen briefly, then close.
    setTimeout(() => chrome.windows.remove(win.id).catch(() => {}), 20 * 1000);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'SET_QUEUE_CONFIG') {
      const apiBase = String(message.apiBase || '').replace(/\/$/, '');
      if (!API_BASE.test(apiBase) || !/^[0-9a-f]{64}$/.test(message.key || '')) {
        return { status: 'error', message: 'פרטי חיבור לא תקינים.' };
      }
      await chrome.storage.local.set({ queueConfig: { apiBase, key: message.key } });
      chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 1 });
      return { status: 'connected' };
    }

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
