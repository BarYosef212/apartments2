import { useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '../api/api';
import { Button, Card, Input, Select } from './ui';
import Switch from './ui/switch';

interface QueueSettings {
  enabled: boolean;
  postsPerDay: number;
  groupsPerListing: number;
  startHour: number;
  endHour: number;
  minGapMinutes: number;
  repostDays: number;
  alertEmail: string;
  pausedUntil: string | null;
  extensionConnected: boolean;
  extensionOnline: boolean;
  extensionLastSeen: string | null;
  bounds: Record<string, [number, number]>;
}

interface QueueJob {
  _id: string;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'posted' | 'failed' | 'skipped';
  doneAt: string | null;
  note: string | null;
  apartment: { street: string; city: string } | null;
  group: { name: string } | null;
}

type NumberField = 'postsPerDay' | 'groupsPerListing' | 'startHour' | 'endHour' | 'minGapMinutes' | 'repostDays';

const FIELDS: { key: NumberField; label: string; unit?: string }[] = [
  { key: 'postsPerDay', label: 'פוסטים ביום' },
  { key: 'groupsPerListing', label: 'קבוצות לכל נכס' },
  { key: 'startHour', label: 'משעה' },
  { key: 'endHour', label: 'עד שעה' },
  { key: 'minGapMinutes', label: 'מרווח בין פוסטים', unit: 'דקות' },
  { key: 'repostDays', label: 'פרסום חוזר באותה קבוצה אחרי', unit: 'ימים' },
];

const SECTIONS: { title: string; fields: NumberField[] }[] = [
  { title: 'כמות', fields: ['postsPerDay', 'groupsPerListing'] },
  { title: 'שעות פרסום', fields: ['startHour', 'endHour'] },
  { title: 'קצב', fields: ['minGapMinutes', 'repostDays'] },
];

const HOUR_FIELDS: NumberField[] = ['startHour', 'endHour'];

const STATUS: Record<QueueJob['status'], { label: string; className: string }> = {
  pending: { label: 'ממתין', className: 'text-taupe' },
  sent: { label: 'מתפרסם עכשיו', className: 'text-amber-700' },
  posted: { label: 'פורסם', className: 'text-emerald-700' },
  failed: { label: 'נכשל', className: 'text-red-700' },
  skipped: { label: 'דולג', className: 'text-taupe' },
};

const SERVER_MESSAGES: Record<string, string> = {
  'Extension not connected': 'יש לחבר קודם את התוסף לתור.',
  'Out of range': 'אחד הערכים מחוץ לטווח המותר.',
  'Invalid email': 'כתובת האימייל אינה תקינה.',
};

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const dayTime = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string })?.message;
    if (message) return SERVER_MESSAGES[message] ?? fallback;
  }
  return fallback;
}

/**
 * The automatic posting queue: each day the server picks listings and groups
 * at random and spreads them over the working hours; the Chrome extension
 * posts them. Conservative by default.
 */
export function FacebookQueueCard({
  extensionInstalled,
  connectExtension,
  onNotice,
  onError,
}: {
  extensionInstalled: boolean;
  connectExtension: (apiBase: string, key: string) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [saved, setSaved] = useState<QueueSettings | null>(null);
  const [form, setForm] = useState<Record<NumberField, string> & { alertEmail: string }>();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [busy, setBusy] = useState(false);

  function apply(settings: QueueSettings) {
    setSaved(settings);
    setForm({
      ...(Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])])) as Record<NumberField, string>),
      alertEmail: settings.alertEmail,
    });
  }

  async function load() {
    const [s, t] = await Promise.all([
      api.get<QueueSettings>('/admin/facebook/queue'),
      api.get<QueueJob[]>('/admin/facebook/queue/today'),
    ]);
    apply(s.data);
    setJobs(t.data);
  }

  useEffect(() => {
    load().catch(() => onError('שגיאה בטעינת התור.'));
    // Keep the status and today's plan fresh while the page is open.
    const id = window.setInterval(() => load().catch(() => {}), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  async function run(action: () => Promise<unknown>, success: string, fallback: string) {
    setBusy(true);
    try {
      await action();
      await load();
      onNotice(success);
    } catch (err) {
      onError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    await run(
      async () => {
        const res = await api.post<{ key: string; apiBase: string }>('/admin/facebook/queue/key');
        connectExtension(res.data.apiBase, res.data.key);
      },
      'התוסף חובר לתור.',
      'חיבור התוסף נכשל.',
    );
  }

  if (!saved || !form) return null;
  const paused = saved.pausedUntil && new Date(saved.pausedUntil) > new Date();
  const field = (key: NumberField) => FIELDS.find((f) => f.key === key)!;

  return (
    <Card className='space-y-6 p-6'>
      <div className='flex flex-wrap items-start justify-between gap-x-8 gap-y-4'>
        <div className='min-w-0 flex-1'>
          <h2 className='font-display text-3xl font-light leading-none'>פרסום אוטומטי בקבוצות</h2>
          <p className='mt-2 max-w-2xl text-sm leading-relaxed text-taupe'>
            כל יום נבחרים באקראי נכסים וקבוצות מתאימות, והתוסף מפרסם אותם לאורך שעות היום,
            כולל הלחיצה על ״פרסום״. כרום צריך להיות פתוח ומחובר לפייסבוק באותן שעות. אזהרה
            מפייסבוק עוצרת הכול ל־48 שעות ושולחת מייל.
          </p>
        </div>
        <div className='flex items-center gap-4'>
          <span
            className={
              paused
                ? 'border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-800'
                : saved.enabled
                  ? 'border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800'
                  : 'border border-line bg-sand px-3 py-1 text-sm text-taupe'
            }
          >
            {paused ? `מושהה עד ${dayTime(saved.pausedUntil!)}` : saved.enabled ? 'פעיל' : 'כבוי'}
          </span>
          <label className='flex cursor-pointer items-center gap-3 text-[15px] font-semibold'>
            פרסום אוטומטי
            <Switch
              checked={saved.enabled}
              disabled={busy || !saved.extensionConnected}
              onCheckedChange={(on) =>
                run(
                  () => api.put('/admin/facebook/queue', { enabled: on }),
                  on ? 'הפרסום האוטומטי הופעל.' : 'הפרסום האוטומטי כובה.',
                  'השינוי נכשל.',
                )
              }
            />
          </label>
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-x-6 gap-y-3 bg-sand px-4 py-3 text-sm'>
        <span>
          התוסף:{' '}
          {!saved.extensionConnected ? (
            <span className='text-taupe'>לא מחובר לתור</span>
          ) : saved.extensionOnline ? (
            <span className='font-semibold text-emerald-800'>מחובר ופעיל</span>
          ) : (
            <span className='text-amber-800'>
              מחובר, לא פעיל כרגע
              {saved.extensionLastSeen ? ` (נראה לאחרונה ${dayTime(saved.extensionLastSeen)})` : ''}
            </span>
          )}
        </span>
        <Button type='button' variant='outline' size='sm' disabled={busy || !extensionInstalled} onClick={connect}>
          {saved.extensionConnected ? 'חיבור מחדש של התוסף' : 'חיבור התוסף לתור'}
        </Button>
        {!extensionInstalled && <span className='text-taupe'>התקינו את התוסף ורעננו את הדף.</span>}
        {!saved.extensionConnected && extensionInstalled && (
          <span className='text-taupe'>צריך לחבר את התוסף לפני שמפעילים.</span>
        )}
        {paused && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={busy}
            onClick={() => {
              if (window.confirm('לחדש את הפרסום לפני תום ההשהיה? זה מגדיל את הסיכון לחסימה.')) {
                run(() => api.post('/admin/facebook/queue/resume'), 'התור חודש.', 'החידוש נכשל.');
              }
            }}
          >
            חידוש לפני הזמן
          </Button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              api.put('/admin/facebook/queue', {
                ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])])),
                alertEmail: form.alertEmail,
              }),
            'הגדרות התור נשמרו. התוכנית של מחר תיבנה לפיהן.',
            'שמירת ההגדרות נכשלה.',
          );
        }}
        className='space-y-6'
      >
        <div className='grid gap-6 md:grid-cols-3'>
          {SECTIONS.map((section) => (
            <fieldset key={section.title} className='space-y-4 border border-line p-4'>
              <legend className='px-1 text-sm font-semibold'>{section.title}</legend>
              {section.fields.map((key) => {
                const f = field(key);
                const [min, max] = saved.bounds[key] ?? [0, 99];
                return (
                  <div key={key} className='space-y-1.5'>
                    <label htmlFor={`queue-${key}`} className='block text-sm text-taupe'>
                      {f.label}
                    </label>
                    {HOUR_FIELDS.includes(key) ? (
                      <Select
                        id={`queue-${key}`}
                        value={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      >
                        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <div className='flex items-center gap-2'>
                        <Input
                          id={`queue-${key}`}
                          type='number'
                          min={min}
                          max={max}
                          className='w-24'
                          value={form[key]}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        />
                        <span className='text-xs text-taupe'>
                          {f.unit ? `${f.unit}, ` : ''}
                          {min} עד {max}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
          ))}
        </div>

        <div className='flex flex-wrap items-end gap-4'>
          <div className='min-w-[260px] flex-1 space-y-1.5'>
            <label htmlFor='queue-alert' className='block text-sm font-medium'>
              מייל להתראות על אזהרה או חסימה
            </label>
            <Input
              id='queue-alert'
              type='email'
              dir='ltr'
              className='text-right'
              placeholder='ריק = המייל לקבלת טפסים'
              value={form.alertEmail}
              onChange={(e) => setForm({ ...form, alertEmail: e.target.value })}
            />
          </div>
          <Button type='submit' disabled={busy}>
            שמירת הגדרות
          </Button>
        </div>
      </form>

      <div className='border-t border-line pt-5'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h3 className='text-sm font-semibold'>התוכנית להיום</h3>
          {saved.enabled && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={busy}
              onClick={() =>
                run(() => api.post('/admin/facebook/queue/replan'), 'נבנתה תוכנית חדשה להיום.', 'בניית התוכנית נכשלה.')
              }
            >
              הגרלה מחדש להיום
            </Button>
          )}
        </div>
        {jobs.length === 0 ? (
          <p className='mt-3 text-sm text-taupe'>
            {saved.enabled
              ? 'אין פוסטים מתוכננים להיום (אין קבוצות מתאימות, או ששעות הפרסום של היום עברו).'
              : 'כשהפרסום האוטומטי יופעל, כאן תופיע התוכנית של היום.'}
          </p>
        ) : (
          <ul className='mt-3 divide-y divide-line border-y border-line text-sm'>
            {jobs.map((job) => (
              <li key={job._id} className='flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5'>
                <span className='w-12 tabular-nums'>{hhmm(job.scheduledAt)}</span>
                <span className='min-w-0 flex-1'>
                  {job.apartment ? `${job.apartment.street}, ${job.apartment.city}` : 'נכס שנמחק'}
                  <span className='text-taupe'> ← {job.group?.name ?? 'קבוצה שנמחקה'}</span>
                </span>
                <span className={STATUS[job.status].className} title={job.note ?? undefined}>
                  {STATUS[job.status].label}
                  {job.note && job.status !== 'posted' ? ` · ${job.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
