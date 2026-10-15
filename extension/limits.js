// Posting limits, enforced here so they hold whatever the admin page sends.
// Defaults follow the research: a handful of groups a day, spaced out.

export const DEFAULTS = {
  dailyCap: 12, // groups per day
  minGapMinutes: 10, // between two fills
};
export const BOUNDS = {
  dailyCap: [1, 25],
  minGapMinutes: [5, 120],
};
// Random extra wait, so posts don't land on a fixed rhythm.
export const JITTER_MINUTES = 5;

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local day

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}

export async function saveSettings(next) {
  const clamp = (key, value) => Math.min(Math.max(Number(value) || DEFAULTS[key], BOUNDS[key][0]), BOUNDS[key][1]);
  const settings = {
    dailyCap: clamp('dailyCap', next.dailyCap),
    minGapMinutes: clamp('minGapMinutes', next.minGapMinutes),
  };
  await chrome.storage.local.set({ settings });
  return settings;
}

/** Today's count, when the next fill is allowed, and whether posting is paused. */
export async function getState() {
  const settings = await getSettings();
  const { usage = {}, nextAllowedAt = 0, pausedUntil = 0 } = await chrome.storage.local.get([
    'usage',
    'nextAllowedAt',
    'pausedUntil',
  ]);
  const count = usage.day === today() ? usage.count : 0;
  return { settings, count, nextAllowedAt, pausedUntil };
}

/** Why a fill can't start now, or null if it can. */
export async function checkAllowed() {
  const { settings, count, nextAllowedAt, pausedUntil } = await getState();
  const now = Date.now();
  if (pausedUntil > now) return { reason: 'paused', until: pausedUntil };
  if (count >= settings.dailyCap) return { reason: 'daily_cap', cap: settings.dailyCap };
  if (nextAllowedAt > now) return { reason: 'too_soon', until: nextAllowedAt };
  return null;
}

/** Counts a fill and sets when the next one may start. */
export async function recordFill() {
  const { settings, count } = await getState();
  const jitter = Math.random() * JITTER_MINUTES * 60 * 1000;
  await chrome.storage.local.set({
    usage: { day: today(), count: count + 1 },
    nextAllowedAt: Date.now() + settings.minGapMinutes * 60 * 1000 + jitter,
  });
}

/** After a Facebook warning: stop everything for 48 hours. */
export async function pause(hours = 48) {
  await chrome.storage.local.set({ pausedUntil: Date.now() + hours * 3600 * 1000 });
}

export async function resume() {
  await chrome.storage.local.set({ pausedUntil: 0 });
}
