import { Request, Response } from 'express';
import { getSettingsDoc } from '../models/ScraperSettings.model';
import { ScrapeLog } from '../models/ScrapeLog.model';
import { isScrapeRunning, ScrapeAlreadyRunningError, startScrapeInBackground } from '../services/yad2Scraper.service';
import { nextRunAt, reschedule } from '../services/scheduler.service';

const MIN_INTERVAL_MINUTES = 10;
const MAX_INTERVAL_MINUTES = 7 * 24 * 60;
const MAX_URLS = 20;

function validYad2Url(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 'yad2.co.il' || u.hostname.endsWith('.yad2.co.il'));
  } catch {
    return false;
  }
}

export class ScraperController {
  async handleGetSettings(req: Request, res: Response) {
    try {
      const s = await getSettingsDoc();
      return res.json(s);
    } catch (error) {
      console.error('Error fetching scraper settings', error);
      return res.status(500).json({ message: 'Error fetching scraper settings' });
    }
  }

  async handleUpdateSettings(req: Request, res: Response) {
    try {
      const { yad2Urls, intervalMinutes, enabled } = req.body ?? {};
      const s = await getSettingsDoc();

      if (yad2Urls !== undefined) {
        if (!Array.isArray(yad2Urls)) {
          return res.status(400).json({ message: 'yad2Urls must be an array' });
        }
        const urls = [...new Set(yad2Urls.map((u: unknown) => String(u).trim()).filter(Boolean))];
        if (urls.length > MAX_URLS) {
          return res.status(400).json({ message: `At most ${MAX_URLS} Yad2 URLs are allowed` });
        }
        if (urls.some((u) => !validYad2Url(u))) {
          return res.status(400).json({ message: 'yad2Url must be an https yad2.co.il URL' });
        }
        s.yad2Urls = urls;
      }
      if (intervalMinutes !== undefined) {
        const n = Number(intervalMinutes);
        if (!Number.isInteger(n) || n < MIN_INTERVAL_MINUTES || n > MAX_INTERVAL_MINUTES) {
          return res.status(400).json({
            message: `intervalMinutes must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES}`,
          });
        }
        s.intervalMinutes = n;
      }
      if (enabled !== undefined) {
        if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be boolean' });
        s.enabled = enabled;
      }
      if (s.enabled && s.yad2Urls.length === 0) {
        return res.status(400).json({ message: 'Cannot enable scraper without a Yad2 URL' });
      }

      await s.save();
      await reschedule();
      return res.json(s);
    } catch (error) {
      console.error('Error updating scraper settings', error);
      return res.status(500).json({ message: 'Error updating scraper settings' });
    }
  }

  async handleRun(req: Request, res: Response) {
    try {
      const s = await getSettingsDoc();
      if (s.yad2Urls.length === 0) return res.status(400).json({ message: 'Yad2 URL is not configured' });
      startScrapeInBackground('manual');
      return res.status(202).json({ running: true, message: 'Scan started' });
    } catch (error) {
      if (error instanceof ScrapeAlreadyRunningError) {
        return res.status(409).json({ running: true, message: error.message });
      }
      console.error('Error starting scan', error);
      return res.status(500).json({ message: 'Error starting scan' });
    }
  }

  async handleStatus(req: Request, res: Response) {
    try {
      const s = await getSettingsDoc();
      return res.json({
        running: isScrapeRunning(),
        lastRunAt: s.lastRunAt,
        lastStatus: s.lastStatus,
        lastError: s.lastError,
        lastResult: s.lastResult,
        nextRunAt: nextRunAt(s),
      });
    } catch (error) {
      console.error('Error fetching scraper status', error);
      return res.status(500).json({ message: 'Error fetching scraper status' });
    }
  }

  async handleLogs(req: Request, res: Response) {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 200);
      const logs = await ScrapeLog.find().sort({ startedAt: -1 }).limit(limit).lean();
      return res.json(logs);
    } catch (error) {
      console.error('Error fetching scrape logs', error);
      return res.status(500).json({ message: 'Error fetching scrape logs' });
    }
  }
}
