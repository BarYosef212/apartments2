import { Request, Response } from 'express';
import { getSettingsDoc } from '../models/ScraperSettings.model';
import { ScrapeLog } from '../models/ScrapeLog.model';
import { isScrapeRunning, ScrapeAlreadyRunningError, startScrapeInBackground } from '../services/yad2Scraper.service';
import { reschedule } from '../services/scheduler.service';

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 168;

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
      const { yad2Url, intervalHours, enabled } = req.body ?? {};
      const s = await getSettingsDoc();

      if (yad2Url !== undefined) {
        if (yad2Url !== '' && !validYad2Url(String(yad2Url))) {
          return res.status(400).json({ message: 'yad2Url must be an https yad2.co.il URL' });
        }
        s.yad2Url = String(yad2Url).trim();
      }
      if (intervalHours !== undefined) {
        const n = Number(intervalHours);
        if (!Number.isFinite(n) || n < MIN_INTERVAL || n > MAX_INTERVAL) {
          return res.status(400).json({ message: `intervalHours must be between ${MIN_INTERVAL} and ${MAX_INTERVAL}` });
        }
        s.intervalHours = n;
      }
      if (enabled !== undefined) {
        if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be boolean' });
        s.enabled = enabled;
      }
      if (s.enabled && !s.yad2Url) {
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
      if (!s.yad2Url) return res.status(400).json({ message: 'Yad2 URL is not configured' });
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
