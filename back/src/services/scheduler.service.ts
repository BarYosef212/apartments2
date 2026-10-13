import { getSettingsDoc } from '../models/ScraperSettings.model';
import { isScrapeRunning, runScrape } from './yad2Scraper.service';

let timer: NodeJS.Timeout | null = null;

export async function reschedule() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const settings = await getSettingsDoc();
  if (!settings.enabled || settings.yad2Urls.length === 0) {
    console.info('[scheduler] disabled');
    return;
  }
  const ms = settings.intervalMinutes * 60 * 1000;
  timer = setInterval(() => {
    if (isScrapeRunning()) return;
    runScrape('schedule').catch((e) => console.error('[scheduler] run error', e));
  }, ms);
  timer.unref();
  console.info(`[scheduler] scheduled every ${settings.intervalMinutes} min`);
}
