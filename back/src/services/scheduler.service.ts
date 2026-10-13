import { getSettingsDoc } from '../models/ScraperSettings.model';
import { isScrapeRunning, runScrape } from './yad2Scraper.service';

// The schedule is measured from the last run stored in the DB, not from when
// this process started, so server restarts don't push scans back.
const CHECK_EVERY_MS = 60 * 1000;
const FIRST_CHECK_DELAY_MS = 15 * 1000;

let timer: NodeJS.Timeout | null = null;
let firstCheck: NodeJS.Timeout | null = null;

type Settings = Awaited<ReturnType<typeof getSettingsDoc>>;

/** When the next scheduled scan is due, or null when scheduling is off. */
export function nextRunAt(settings: Settings): Date | null {
  if (!settings.enabled || settings.yad2Urls.length === 0) return null;
  if (!settings.lastRunAt) return new Date();
  return new Date(settings.lastRunAt.getTime() + settings.intervalMinutes * 60 * 1000);
}

async function tick() {
  try {
    if (isScrapeRunning()) return;
    const settings = await getSettingsDoc();
    const due = nextRunAt(settings);
    if (!due || due.getTime() > Date.now()) return;
    await runScrape('schedule');
  } catch (e) {
    console.error('[scheduler] run error', e);
  }
}

export async function reschedule() {
  if (timer) clearInterval(timer);
  if (firstCheck) clearTimeout(firstCheck);
  timer = firstCheck = null;

  const settings = await getSettingsDoc();
  const due = nextRunAt(settings);
  if (!due) {
    console.info('[scheduler] disabled');
    return;
  }
  timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref();
  firstCheck = setTimeout(tick, FIRST_CHECK_DELAY_MS);
  firstCheck.unref();
  console.info(`[scheduler] every ${settings.intervalMinutes} min, next at ${due.toISOString()}`);
}
