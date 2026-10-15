import { useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '../api/api';
import { Button, Card, Input } from './ui';

interface PageSettings {
  pageId: string;
  hasToken: boolean;
  autoPost: boolean;
  autoPostSince: string | null;
}

const SERVER_MESSAGES: Record<string, string> = {
  'Invalid page id': 'מזהה העמוד צריך להיות מספר (רק ספרות).',
  'Invalid token': 'מפתח הגישה אינו תקין.',
  'Page is not configured': 'יש להזין ולשמור קודם מזהה עמוד ומפתח גישה.',
};

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; detail?: string };
    if (data?.message) return SERVER_MESSAGES[data.message] ?? `${fallback} (${data.detail ?? data.message})`;
  }
  return fallback;
}

/**
 * The office's Facebook business Page: official, allowed automatic posting
 * through Meta's API. Until the Page exists, the fields stay empty and
 * nothing is posted.
 */
export function FacebookPageCard({
  onReadyChange,
  onNotice,
  onError,
}: {
  onReadyChange: (ready: boolean) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [saved, setSaved] = useState<PageSettings | null>(null);
  const [pageId, setPageId] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'auto' | null>(null);

  function apply(settings: PageSettings) {
    setSaved(settings);
    setPageId(settings.pageId);
    onReadyChange(!!settings.pageId && settings.hasToken);
  }

  useEffect(() => {
    api
      .get<PageSettings>('/admin/facebook/page')
      .then((res) => apply(res.data))
      .catch(() => onError('שגיאה בטעינת הגדרות העמוד העסקי.'));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy('save');
    try {
      const res = await api.put<PageSettings>('/admin/facebook/page', {
        pageId,
        ...(token.trim() && { token }),
      });
      apply(res.data);
      setToken('');
      onNotice('פרטי העמוד העסקי נשמרו.');
    } catch (err) {
      onError(errorMessage(err, 'השמירה נכשלה.'));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    try {
      const res = await api.post<{ name: string }>('/admin/facebook/page/test');
      onNotice(`החיבור תקין: העמוד ״${res.data.name}״.`);
    } catch (err) {
      onError(errorMessage(err, 'החיבור לעמוד נכשל. בדקו את המזהה ואת מפתח הגישה.'));
    } finally {
      setBusy(null);
    }
  }

  async function toggleAuto(on: boolean) {
    setBusy('auto');
    try {
      const res = await api.put<PageSettings>('/admin/facebook/page', { autoPost: on });
      apply(res.data);
      onNotice(
        on
          ? 'פרסום אוטומטי הופעל: כל נכס חדש מיד2 יעלה לעמוד (עד 3 בכל סריקה).'
          : 'הפרסום האוטומטי לעמוד כובה.',
      );
    } catch (err) {
      onError(errorMessage(err, 'השינוי נכשל.'));
    } finally {
      setBusy(null);
    }
  }

  if (!saved) return null;
  const ready = !!saved.pageId && saved.hasToken;

  return (
    <Card className='space-y-5 p-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h2 className='font-display text-3xl font-light leading-none'>עמוד עסקי בפייסבוק</h2>
          <p className='mt-2 max-w-2xl text-sm text-taupe'>
            פרסום רשמי ומותר לעמוד של המשרד, עם כל התמונות. בלי סיכון לחשבון. עד שתזינו את
            פרטי העמוד, שום דבר לא מתפרסם.
          </p>
        </div>
        <span
          className={
            ready
              ? 'border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800'
              : 'border border-line bg-sand px-3 py-1 text-sm text-taupe'
          }
        >
          {ready ? 'מחובר' : 'לא הוגדר עדיין'}
        </span>
      </div>

      <form onSubmit={save} className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-end'>
        <div className='space-y-1.5'>
          <label htmlFor='fb-page-id' className='text-sm font-medium'>
            מזהה העמוד (Page ID)
          </label>
          <Input
            id='fb-page-id'
            dir='ltr'
            className='text-right'
            inputMode='numeric'
            placeholder='למשל 123456789012345'
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
          />
        </div>
        <div className='space-y-1.5'>
          <label htmlFor='fb-page-token' className='text-sm font-medium'>
            מפתח גישה לעמוד (Page access token)
          </label>
          <Input
            id='fb-page-token'
            type='password'
            dir='ltr'
            className='text-right'
            autoComplete='off'
            placeholder={saved.hasToken ? 'שמור. הזינו רק כדי להחליף' : ''}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <Button type='submit' disabled={busy !== null}>
          {busy === 'save' ? 'שומר…' : 'שמירה'}
        </Button>
      </form>

      <div className='flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-5'>
        <Button type='button' variant='outline' disabled={!ready || busy !== null} onClick={test}>
          {busy === 'test' ? 'בודק…' : 'בדיקת חיבור'}
        </Button>
        <label className='flex min-h-11 cursor-pointer items-center gap-2.5 text-sm'>
          <input
            type='checkbox'
            className='h-4 w-4 accent-ink'
            disabled={!ready || busy !== null}
            checked={saved.autoPost}
            onChange={(e) => toggleAuto(e.target.checked)}
          />
          פרסום אוטומטי של נכסים חדשים מיד2 לעמוד
        </label>
      </div>

      <details className='text-sm text-taupe'>
        <summary className='cursor-pointer hover:text-ink'>איך משיגים מזהה עמוד ומפתח גישה?</summary>
        <ol className='mt-3 list-decimal space-y-1.5 pr-5 leading-relaxed'>
          <li>יוצרים עמוד עסקי בפייסבוק למשרד.</li>
          <li>
            מזהה העמוד: בעמוד, ״אודות״ ← ״שקיפות העמוד״, או בהגדרות העמוד. זה מספר ארוך.
          </li>
          <li>
            יוצרים אפליקציה ב־
            <a href='https://developers.facebook.com/apps' target='_blank' rel='noopener noreferrer' className='underline'>
              Meta for Developers
            </a>{' '}
            ומוסיפים לה הרשאות לניהול פוסטים בעמוד (pages_manage_posts, pages_read_engagement).
          </li>
          <li>
            ב־
            <a href='https://developers.facebook.com/tools/explorer/' target='_blank' rel='noopener noreferrer' className='underline'>
              Graph API Explorer
            </a>{' '}
            מפיקים מפתח גישה לעמוד, ומחליפים אותו במפתח לטווח ארוך.
          </li>
          <li>מדביקים כאן, שומרים ולוחצים ״בדיקת חיבור״.</li>
        </ol>
        <p className='mt-2'>
          התמונות של יד2 עוברות ישר. תמונות שהועלו לאתר יעלו לעמוד רק כשהאתר באוויר עם כתובת
          אמיתית.
        </p>
      </details>
    </Card>
  );
}
