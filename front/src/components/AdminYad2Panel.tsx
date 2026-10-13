import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import axios from 'axios';
import { Button, Card, Input, Select } from './ui';
import Switch from './ui/switch';
import { useScraperApi } from '../hooks/useScraperApi';
import {
  ScrapeLog,
  ScrapeStatus,
  ScraperSettingsInput,
  ScraperStatus,
} from '../types/scraper.types';

const INTERVAL_OPTIONS = [
  { value: 1, label: 'כל שעה' },
  { value: 3, label: 'כל 3 שעות' },
  { value: 6, label: 'כל 6 שעות' },
  { value: 12, label: 'כל 12 שעות' },
  { value: 24, label: 'פעם ביום' },
  { value: 48, label: 'כל יומיים' },
  { value: 168, label: 'פעם בשבוע' },
];

const STATUS_LABELS: Record<NonNullable<ScrapeStatus>, string> = {
  success: 'הצליחה',
  failed: 'נכשלה',
  running: 'רצה כעת',
};

const STATUS_STYLES: Record<NonNullable<ScrapeStatus>, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  running: 'bg-amber-50 text-amber-700',
};

const POLL_INTERVAL_MS = 3000;
const MAX_URLS = 20;

const EMPTY_FORM: ScraperSettingsInput = {
  yad2Urls: [],
  intervalHours: 12,
  enabled: false,
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string, end?: string | null) {
  if (!end) return '—';
  const seconds = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000,
  );
  return seconds < 60 ? `${seconds} שנ׳` : `${Math.round(seconds / 60)} דק׳`;
}

const SERVER_MESSAGES: Record<string, string> = {
  'yad2Url must be an https yad2.co.il URL':
    'כל הקישורים חייבים להיות כתובות https של yad2.co.il.',
  [`At most ${MAX_URLS} Yad2 URLs are allowed`]: `ניתן לשמור עד ${MAX_URLS} קישורים.`,
  'Cannot enable scraper without a Yad2 URL':
    'לא ניתן להפעיל סריקה אוטומטית ללא קישור ליד2.',
  'Yad2 URL is not configured': 'יש לשמור קישור ליד2 לפני סריקה.',
  'Server restarted during scan': 'הסריקה נקטעה כי השרת הופעל מחדש.',
  'Yad2 blocked the request (bot protection)':
    'יד2 חסמו את הסריקה (הגנה מפני בוטים). נסו שוב מאוחר יותר.',
};

// Multi-link scans report one failure per line as "<url>: <message>".
function translate(message?: string | null) {
  if (!message) return '';
  return message
    .split('\n')
    .map((line) => {
      const match = line.match(/^(https?:\/\/\S+): (.*)$/);
      if (!match) return SERVER_MESSAGES[line] ?? line;
      return `${match[1]}: ${SERVER_MESSAGES[match[2]] ?? match[2]}`;
    })
    .join('\n');
}

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string };
    const message = data?.message || data?.error;
    return message ? translate(message) : fallback;
  }
  return fallback;
}

function toForm(settings: Partial<ScraperSettingsInput>): ScraperSettingsInput {
  return {
    yad2Urls: settings.yad2Urls ?? [],
    intervalHours: settings.intervalHours ?? 12,
    enabled: Boolean(settings.enabled),
  };
}

function StatusPill({ status }: { status?: ScrapeStatus }) {
  if (!status) {
    return <span className='text-sm text-muted-foreground'>טרם בוצעה</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AdminYad2Panel() {
  const { fetchSettings, saveSettings, fetchStatus, fetchLogs, runScan } =
    useScraperApi();

  const [form, setForm] = useState<ScraperSettingsInput>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<ScraperSettingsInput>(EMPTY_FORM);
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const wasRunning = useRef(false);
  const isRunning = Boolean(status?.running) || isStarting;
  // The editor always shows at least one (possibly empty) row; empty rows are
  // dropped when saving.
  const urlRows = form.yad2Urls.length > 0 ? form.yad2Urls : [''];
  const cleanUrls = form.yad2Urls.map((u) => u.trim()).filter(Boolean);
  const isDirty =
    JSON.stringify({ ...form, yad2Urls: cleanUrls }) !==
    JSON.stringify(savedForm);
  const hasSavedUrls = savedForm.yad2Urls.length > 0;

  function setUrl(index: number, value: string) {
    const next = [...urlRows];
    next[index] = value;
    setForm({ ...form, yad2Urls: next });
  }

  function addUrl() {
    setForm({ ...form, yad2Urls: [...urlRows, ''] });
  }

  function removeUrl(index: number) {
    setForm({ ...form, yad2Urls: urlRows.filter((_, i) => i !== index) });
  }

  async function refreshStatusAndLogs() {
    const [statusRes, logsRes] = await Promise.all([
      fetchStatus(),
      fetchLogs(20),
    ]);
    setStatus(statusRes);
    setLogs(logsRes);
  }

  useEffect(() => {
    async function load() {
      try {
        const settings = await fetchSettings();
        const next = toForm(settings);
        setForm(next);
        setSavedForm(next);
        await refreshStatusAndLogs();
      } catch (err) {
        setError(errorMessage(err, 'שגיאה בטעינת הגדרות הסריקה.'));
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // While a scan is running, poll until it finishes, then refresh the log.
  useEffect(() => {
    if (!status?.running) {
      if (wasRunning.current) {
        wasRunning.current = false;
        refreshStatusAndLogs().catch(() => {});
      }
      return;
    }
    wasRunning.current = true;
    const id = window.setInterval(() => {
      fetchStatus()
        .then(setStatus)
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [status?.running]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveSettings({ ...form, yad2Urls: cleanUrls });
      const next = toForm(saved);
      setForm(next);
      setSavedForm(next);
      setNotice('ההגדרות נשמרו.');
      setStatus(await fetchStatus());
    } catch (err) {
      setError(errorMessage(err, 'שגיאה בשמירת ההגדרות.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRun() {
    setIsStarting(true);
    setError(null);
    setNotice(null);
    try {
      await runScan();
      setNotice('הסריקה התחילה. התוצאות יופיעו כאן בסיומה.');
      await refreshStatusAndLogs();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setNotice('סריקה כבר רצה כעת.');
        setStatus(await fetchStatus());
      } else {
        setError(errorMessage(err, 'לא ניתן היה להתחיל סריקה.'));
      }
    } finally {
      setIsStarting(false);
    }
  }

  if (isLoading) {
    return (
      <div className='py-16 text-center text-sm text-muted-foreground animate-pulse'>
        טוען…
      </div>
    );
  }

  const result = status?.lastResult;

  return (
    <div className='space-y-6'>
      {error && (
        <div className='rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600'>
          {error}
        </div>
      )}
      {notice && !error && (
        <div className='rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700'>
          {notice}
        </div>
      )}

      <div className='grid gap-6 lg:grid-cols-5'>
        <Card className='border border-gray-100 p-6 shadow-sm lg:col-span-3'>
          <form onSubmit={handleSave} className='space-y-5 text-right'>
            <div>
              <h2 className='text-base font-semibold text-gray-900'>
                הגדרות סריקה
              </h2>
              <p className='mt-1 text-sm text-muted-foreground'>
                המערכת תסרוק את העמודים ביד2 ותעדכן את הדירות באתר.
              </p>
            </div>

            <fieldset className='space-y-2'>
              <legend className='mb-1.5 text-sm font-medium'>
                קישורים לעמודי דירות ביד2
              </legend>
              {urlRows.map((url, index) => (
                <div key={index} className='flex items-center gap-2'>
                  <Input
                    type='url'
                    dir='ltr'
                    aria-label={`קישור ${index + 1}`}
                    placeholder='https://www.yad2.co.il/realestate/agency/...'
                    value={url}
                    onChange={(e) => setUrl(index, e.target.value)}
                  />
                  {urlRows.length > 1 && (
                    <button
                      type='button'
                      onClick={() => removeUrl(index)}
                      aria-label={`הסרת קישור ${index + 1}`}
                      className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-900'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  )}
                </div>
              ))}
              {urlRows.length < MAX_URLS && (
                <button
                  type='button'
                  onClick={addUrl}
                  className='inline-flex items-center gap-1.5 rounded-md py-1 text-sm font-medium text-gray-700 hover:text-gray-900'
                >
                  <Plus className='h-4 w-4' />
                  הוספת קישור
                </button>
              )}
            </fieldset>

            <div className='grid gap-5 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <label htmlFor='interval' className='text-sm font-medium'>
                  תדירות סריקה
                </label>
                <Select
                  id='interval'
                  value={form.intervalHours}
                  onChange={(e) =>
                    setForm({ ...form, intervalHours: Number(e.target.value) })
                  }
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className='space-y-1.5'>
                <span className='text-sm font-medium'>סריקה אוטומטית</span>
                <label className='flex h-10 items-center gap-3 text-sm text-gray-700'>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, enabled: checked })
                    }
                  />
                  {form.enabled ? 'פעילה' : 'כבויה'}
                </label>
              </div>
            </div>

            <div className='flex justify-end'>
              <Button type='submit' disabled={!isDirty || isSaving}>
                {isSaving ? 'שומר…' : 'שמירת הגדרות'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className='flex flex-col border border-gray-100 p-6 text-right shadow-sm lg:col-span-2'>
          <h2 className='text-base font-semibold text-gray-900'>
            סריקה אחרונה
          </h2>

          <dl className='mt-4 space-y-3 text-sm'>
            <div className='flex items-center justify-between'>
              <dt className='text-muted-foreground'>סטטוס</dt>
              <dd>
                <StatusPill
                  status={status?.running ? 'running' : status?.lastStatus}
                />
              </dd>
            </div>
            <div className='flex items-center justify-between'>
              <dt className='text-muted-foreground'>מועד</dt>
              <dd className='tabular-nums'>{formatDate(status?.lastRunAt)}</dd>
            </div>
            {status?.nextRunAt && savedForm.enabled && (
              <div className='flex items-center justify-between'>
                <dt className='text-muted-foreground'>הסריקה הבאה</dt>
                <dd className='tabular-nums'>{formatDate(status.nextRunAt)}</dd>
              </div>
            )}
          </dl>

          {result && (
            <div className='mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-gray-100 rounded-lg border border-gray-100 text-center'>
              {[
                { label: 'נוספו', value: result.added },
                { label: 'עודכנו', value: result.updated },
                { label: 'הוסרו', value: result.deactivated },
              ].map((item) => (
                <div key={item.label} className='py-3'>
                  <div className='text-lg font-semibold tabular-nums'>
                    {item.value ?? 0}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {status?.lastStatus === 'failed' && status.lastError && (
            <p className='mt-4 whitespace-pre-line break-all rounded-md bg-red-50 p-3 text-xs text-red-700'>
              {translate(status.lastError)}
            </p>
          )}

          <div className='mt-auto pt-6'>
            <Button
              type='button'
              className='w-full'
              onClick={handleRun}
              disabled={isRunning || !hasSavedUrls}
            >
              {isRunning ? 'סורק…' : 'סרוק עכשיו'}
            </Button>
            {!hasSavedUrls && (
              <p className='mt-2 text-center text-xs text-muted-foreground'>
                יש לשמור קישור ליד2 לפני סריקה.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className='overflow-hidden border border-gray-100 shadow-sm'>
        <div className='border-b border-gray-100 px-6 py-4 text-right'>
          <h2 className='text-base font-semibold text-gray-900'>
            היסטוריית סריקות
          </h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-right text-xs md:text-sm'>
            <thead className='bg-gray-50 text-gray-500'>
              <tr>
                <th className='py-3 pl-4 pr-6 font-medium'>מועד</th>
                <th className='py-3 pl-4 font-medium'>הפעלה</th>
                <th className='py-3 pl-4 font-medium'>סטטוס</th>
                <th className='py-3 pl-4 font-medium'>משך</th>
                <th className='py-3 pl-4 font-medium'>נוספו / עודכנו / הוסרו</th>
                <th className='py-3 pl-4 font-medium'>שגיאה</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100 bg-white'>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className='py-10 text-center text-muted-foreground'
                  >
                    עדיין לא בוצעו סריקות.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td className='py-3 pl-4 pr-6 tabular-nums'>
                      {formatDate(log.startedAt)}
                    </td>
                    <td className='py-3 pl-4'>
                      {log.trigger === 'manual' ? 'ידנית' : 'מתוזמנת'}
                    </td>
                    <td className='py-3 pl-4'>
                      <StatusPill status={log.status} />
                    </td>
                    <td className='py-3 pl-4 tabular-nums'>
                      {formatDuration(log.startedAt, log.finishedAt)}
                    </td>
                    <td className='py-3 pl-4 tabular-nums'>
                      {log.counts
                        ? `${log.counts.added ?? 0} / ${log.counts.updated ?? 0} / ${log.counts.deactivated ?? 0}`
                        : '—'}
                    </td>
                    <td
                      className='max-w-xs truncate py-3 pl-4 text-red-600'
                      title={translate(log.error)}
                    >
                      {translate(log.error)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
