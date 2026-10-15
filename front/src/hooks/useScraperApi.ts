import { api } from '../api/api';
import { UseScraperApi } from '../types/customHooks.types';
import {
  ScrapeLog,
  ScraperSettings,
  ScraperSettingsInput,
  ScraperStatus,
} from '../types/scraper.types';

const BASE = '/admin/scraper';

export function useScraperApi(): UseScraperApi {
  const fetchSettings = async () => {
    const res = await api.get<ScraperSettings>(`${BASE}/settings`);
    return res.data;
  };

  const saveSettings = async (payload: ScraperSettingsInput) => {
    const res = await api.put<ScraperSettings>(`${BASE}/settings`, payload);
    return res.data;
  };

  const fetchStatus = async () => {
    const res = await api.get<ScraperStatus>(`${BASE}/status`);
    return res.data;
  };

  const fetchLogs = async (limit = 20) => {
    const res = await api.get<ScrapeLog[] | { logs: ScrapeLog[] }>(
      `${BASE}/logs`,
      { params: { limit } },
    );
    return Array.isArray(res.data) ? res.data : res.data.logs ?? [];
  };

  const runScan = async () => {
    await api.post(`${BASE}/run`);
  };

  return { fetchSettings, saveSettings, fetchStatus, fetchLogs, runScan };
}
