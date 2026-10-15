import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { Button, Card, Input } from './ui';
import { useSiteAdminApi, SiteSettingsUpdate } from '../hooks/useSiteAdminApi';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { mediaUrl } from '../lib/format';
import { SiteContact, SiteSettings, SiteTexts } from '../types/site.types';

const MAX_UPLOAD_MB = 100;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const VIDEO_TYPES = 'video/mp4,video/webm,video/quicktime';

const SECTION_TITLE = 'font-display text-3xl font-light leading-none';
const LABEL = 'text-sm font-medium';
const TEXTAREA =
  'w-full border border-line bg-white px-3.5 py-2.5 text-[15px] leading-relaxed focus-visible:border-ink focus-visible:outline-none';

const TEXT_FIELDS: { key: keyof SiteTexts; label: string; hint?: string; rows?: number }[] = [
  { key: 'heroEyebrow', label: 'שורת אזורים (מעל הכותרת)' },
  { key: 'heroTitle', label: 'כותרת ראשית', hint: 'Enter יוצר שורה חדשה בכותרת', rows: 2 },
  { key: 'heroSubtitle', label: 'טקסט מתחת לכותרת', rows: 3 },
  { key: 'ownersTitle', label: 'כותרת לבעלי נכסים', hint: 'Enter יוצר שורה חדשה בכותרת', rows: 2 },
  { key: 'ownersText', label: 'טקסט לבעלי נכסים', rows: 3 },
];

const CONTACT_FIELDS: { key: keyof SiteContact; label: string; hint?: string; type?: string; ltr?: boolean }[] = [
  { key: 'phone', label: 'טלפון', type: 'tel', ltr: true },
  { key: 'whatsapp', label: 'וואטסאפ (מספר טלפון)', type: 'tel', ltr: true },
  { key: 'email', label: 'אימייל', type: 'email', ltr: true },
  { key: 'address', label: 'כתובת המשרד' },
  { key: 'license', label: 'מספר רישיון תיווך', ltr: true },
];

const SERVER_MESSAGES: Record<string, string> = {
  'File is too large': `הקובץ גדול מדי (עד ${MAX_UPLOAD_MB}MB).`,
  'Unsupported or missing file': 'סוג קובץ לא נתמך. אפשר JPG, PNG, WEBP, MP4, WEBM או MOV.',
  'Invalid email': 'כתובת האימייל אינה תקינה.',
  'Text is too long': 'אחד הטקסטים ארוך מדי.',
  'Invalid SMTP host': 'כתובת שרת המייל אינה תקינה.',
  'Invalid SMTP port': 'הפורט אינו תקין.',
  'No leads email': 'יש להזין קודם מייל לקבלת טפסים ולשמור.',
  'Mail is not configured': 'יש להזין קודם את פרטי שרת המייל ולשמור.',
};

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string })?.message;
    if (message) return SERVER_MESSAGES[message] ?? message;
  }
  return fallback;
}

export function AdminSitePanel() {
  const { fetchSettings, saveSettings, uploadMedia, sendTestMail } = useSiteAdminApi();
  const { setSettings: publish } = useSiteSettings();

  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [texts, setTexts] = useState<SiteTexts | null>(null);
  const [contact, setContact] = useState<SiteContact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then((settings) => applySaved(settings, true))
      .catch((err) => setError(errorMessage(err, 'שגיאה בטעינת הגדרות האתר.')));
  }, []);

  // Forms are reset only by their own save, so saving one card (or uploading
  // an image) doesn't discard unsaved edits in another.
  function applySaved(settings: SiteSettings, resetForms = false) {
    setSaved(settings);
    if (resetForms) {
      setTexts(settings.texts);
      setContact(settings.contact);
    }
    publish(settings);
  }

  async function save(update: SiteSettingsUpdate, successMessage: string, resetForms = false) {
    setError(null);
    setNotice(null);
    const next = await saveSettings(update);
    applySaved(next, resetForms);
    setNotice(successMessage);
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!texts || !contact) return;
    setIsSaving(true);
    try {
      const { leadsEmail: _managedByMailCard, ...publicContact } = contact;
      await save({ texts, contact: publicContact }, 'הטקסטים ופרטי הקשר נשמרו.', true);
    } catch (err) {
      setError(errorMessage(err, 'שגיאה בשמירה.'));
    } finally {
      setIsSaving(false);
    }
  }

  if (!saved || !texts || !contact) {
    return error ? (
      <Alert tone='error'>{error}</Alert>
    ) : (
      <div className='animate-pulse py-16 text-center text-sm text-taupe'>טוען…</div>
    );
  }

  const isDirty = TEXT_FIELDS.some((f) => texts[f.key] !== saved.texts[f.key]) ||
    CONTACT_FIELDS.some((f) => (contact[f.key] ?? '') !== (saved.contact[f.key] ?? ''));

  return (
    <div className='space-y-6'>
      {error && <Alert tone='error'>{error}</Alert>}
      {notice && !error && <Alert>{notice}</Alert>}

      <div className='grid gap-6 lg:grid-cols-2'>
        <MediaPicker
          title='תמונה או סרטון בראש עמוד הבית'
          description='בלי בחירה, מוצגת אוטומטית התמונה של הנכס היקר ביותר.'
          accept={`${IMAGE_TYPES},${VIDEO_TYPES}`}
          current={saved.heroMedia.url ? saved.heroMedia : null}
          onUpload={async (file, onProgress) => {
            const { url, kind } = await uploadMedia(file, onProgress);
            // Replacing the first video keeps the rest of the sequence.
            const more = kind === 'video' ? saved.heroMedia.more ?? [] : [];
            await save({ heroMedia: { kind, url, more } }, 'המדיה בעמוד הבית עודכנה.');
          }}
          onClear={() =>
            save({ heroMedia: { kind: 'image', url: '', more: [] } }, 'חזרה לתמונה אוטומטית.')
          }
          onError={setError}
        >
          {saved.heroMedia.kind === 'video' && saved.heroMedia.url && (
            <HeroSequence
              clips={[saved.heroMedia.url, ...(saved.heroMedia.more ?? [])]}
              onAdd={async (file, onProgress) => {
                const { url, kind } = await uploadMedia(file, onProgress);
                if (kind !== 'video') throw new Error('not a video');
                await save(
                  { heroMedia: { ...saved.heroMedia, more: [...(saved.heroMedia.more ?? []), url] } },
                  'הסרטון נוסף לרצף.',
                );
              }}
              onRemove={(clip) =>
                save(
                  {
                    heroMedia: {
                      ...saved.heroMedia,
                      more: (saved.heroMedia.more ?? []).filter((u) => u !== clip),
                    },
                  },
                  'הסרטון הוסר מהרצף.',
                )
              }
              onError={setError}
            />
          )}
        </MediaPicker>
        <MediaPicker
          title='תמונה לחלק של בעלי הנכסים'
          description='בלי בחירה, מוצגת תמונה של אחד הנכסים.'
          accept={IMAGE_TYPES}
          current={saved.ownersImage ? { kind: 'image', url: saved.ownersImage } : null}
          onUpload={async (file, onProgress) => {
            const { url } = await uploadMedia(file, onProgress);
            await save({ ownersImage: url }, 'התמונה לבעלי הנכסים עודכנה.');
          }}
          onClear={() => save({ ownersImage: '' }, 'חזרה לתמונה אוטומטית.')}
          onError={setError}
        />
      </div>

      <form onSubmit={handleSaveDetails} className='grid gap-6 lg:grid-cols-2'>
        <Card className='space-y-5 p-6'>
          <h2 className={SECTION_TITLE}>כותרות וטקסטים</h2>
          {TEXT_FIELDS.map((field) => (
            <div key={field.key} className='space-y-1.5'>
              <label htmlFor={`text-${field.key}`} className={LABEL}>
                {field.label}
              </label>
              {field.rows ? (
                <textarea
                  id={`text-${field.key}`}
                  rows={field.rows}
                  maxLength={400}
                  className={TEXTAREA}
                  value={texts[field.key]}
                  onChange={(e) => setTexts({ ...texts, [field.key]: e.target.value })}
                />
              ) : (
                <Input
                  id={`text-${field.key}`}
                  maxLength={400}
                  value={texts[field.key]}
                  onChange={(e) => setTexts({ ...texts, [field.key]: e.target.value })}
                />
              )}
              {field.hint && <p className='text-xs text-taupe'>{field.hint}</p>}
            </div>
          ))}
        </Card>

        <Card className='flex flex-col gap-5 p-6'>
          <h2 className={SECTION_TITLE}>פרטי יצירת קשר</h2>
          <p className='-mt-2 text-sm text-taupe'>
            מוצגים בתחתית האתר ובעמוד כל נכס. שדה ריק לא יוצג.
          </p>
          {CONTACT_FIELDS.map((field) => (
            <div key={field.key} className='space-y-1.5'>
              <label htmlFor={`contact-${field.key}`} className={LABEL}>
                {field.label}
              </label>
              <Input
                id={`contact-${field.key}`}
                type={field.type ?? 'text'}
                dir={field.ltr ? 'ltr' : undefined}
                className={field.ltr ? 'text-right' : undefined}
                maxLength={200}
                value={contact[field.key] ?? ''}
                onChange={(e) => setContact({ ...contact, [field.key]: e.target.value })}
              />
              {field.hint && <p className='text-xs text-taupe'>{field.hint}</p>}
            </div>
          ))}
          <div className='mt-auto flex justify-end pt-4'>
            <Button type='submit' size='lg' disabled={!isDirty || isSaving}>
              {isSaving ? 'שומר…' : 'שמירת טקסטים ופרטי קשר'}
            </Button>
          </div>
        </Card>
      </form>

      <MailCard
        saved={saved}
        onSave={(update) => save(update, 'הגדרות המייל נשמרו.')}
        onTest={async () => {
          setError(null);
          setNotice(null);
          const to = await sendTestMail();
          setNotice(`נשלח מייל בדיקה אל ${to}. אם הוא לא הגיע תוך דקה, בדקו גם בספאם.`);
        }}
        onError={setError}
      />
    </div>
  );
}

function Alert({ tone, children }: { tone?: 'error'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'border border-red-200 bg-red-50 p-3 text-sm text-red-700'
          : 'border border-line bg-white p-3 text-sm'
      }
    >
      {children}
    </div>
  );
}

function MediaPicker({
  title,
  description,
  accept,
  current,
  onUpload,
  onClear,
  onError,
  children,
}: {
  title: string;
  description: string;
  accept: string;
  current: { kind: 'image' | 'video'; url: string } | null;
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<void>;
  onClear: () => Promise<void>;
  onError: (message: string) => void;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const busy = progress !== null || isClearing;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      onError(`הקובץ גדול מדי (עד ${MAX_UPLOAD_MB}MB).`);
      return;
    }
    setProgress(0);
    try {
      await onUpload(file, setProgress);
    } catch (err) {
      onError(errorMessage(err, 'ההעלאה נכשלה.'));
    } finally {
      setProgress(null);
    }
  }

  async function handleClear() {
    setIsClearing(true);
    try {
      await onClear();
    } catch (err) {
      onError(errorMessage(err, 'שגיאה בשמירה.'));
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <Card className='flex flex-col gap-4 p-6'>
      <div>
        <h2 className={SECTION_TITLE}>{title}</h2>
        <p className='mt-2 text-sm text-taupe'>{description}</p>
      </div>

      <div className='relative aspect-video overflow-hidden bg-[#E6E0D6]'>
        {current?.kind === 'video' && (
          <video
            src={mediaUrl(current.url)}
            muted
            loop
            autoPlay
            playsInline
            className='h-full w-full object-cover'
          />
        )}
        {current?.kind === 'image' && (
          <img src={mediaUrl(current.url)} alt='' className='h-full w-full object-cover' />
        )}
        {!current && (
          <div className='flex h-full items-center justify-center text-sm text-taupe'>
            תמונה אוטומטית מהנכסים
          </div>
        )}
        {progress !== null && (
          <div className='absolute inset-x-0 bottom-0 bg-white/90 p-3'>
            <div className='h-1 bg-line'>
              <div className='h-full bg-ink transition-all' style={{ width: `${progress}%` }} />
            </div>
            <p className='mt-1.5 text-xs tabular-nums'>מעלה… {progress}%</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type='file'
        accept={accept}
        className='sr-only'
        tabIndex={-1}
        aria-hidden='true'
        onChange={handleFile}
      />
      <div className='flex flex-wrap gap-3'>
        <Button type='button' disabled={busy} onClick={() => inputRef.current?.click()}>
          {current ? 'החלפה' : 'העלאה מהמחשב'}
        </Button>
        {current && (
          <Button type='button' variant='outline' disabled={busy} onClick={handleClear}>
            חזרה לאוטומטי
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

const SMTP_PRESETS = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 465 },
  { id: 'outlook', label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: 587 },
  { id: 'other', label: 'אחר', host: '', port: 465 },
];

function presetOf(host: string) {
  return SMTP_PRESETS.find((p) => p.host && p.host === host)?.id ?? (host ? 'other' : 'gmail');
}

/** Where website forms go, and the mail server that sends them. */
function MailCard({
  saved,
  onSave,
  onTest,
  onError,
}: {
  saved: SiteSettings;
  onSave: (update: SiteSettingsUpdate) => Promise<void>;
  onTest: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const smtp = saved.smtp ?? { host: '', port: 465, user: '', from: '', hasPassword: false };
  const [leadsEmail, setLeadsEmail] = useState(saved.contact.leadsEmail ?? '');
  const [preset, setPreset] = useState(presetOf(smtp.host));
  const [host, setHost] = useState(smtp.host || SMTP_PRESETS[0].host);
  const [port, setPort] = useState(String(smtp.port || 465));
  const [user, setUser] = useState(smtp.user);
  const [pass, setPass] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  function choosePreset(id: string) {
    setPreset(id);
    const p = SMTP_PRESETS.find((x) => x.id === id)!;
    if (p.host) {
      setHost(p.host);
      setPort(String(p.port));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        contact: { leadsEmail },
        smtp: { host, port: Number(port), user, from: user, ...(pass ? { pass } : {}) },
      });
      setPass('');
    } catch (err) {
      onError(errorMessage(err, 'שגיאה בשמירה.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    try {
      await onTest();
    } catch (err) {
      const data = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string; detail?: string })
        : undefined;
      onError(
        data?.message === 'Send failed'
          ? `השליחה נכשלה. בדקו את כתובת המייל והסיסמה. (${data.detail ?? ''})`
          : errorMessage(err, 'השליחה נכשלה.'),
      );
    } finally {
      setIsTesting(false);
    }
  }

  const isGmail = preset === 'gmail';

  return (
    <form onSubmit={handleSave}>
      <Card className='space-y-6 p-6'>
        <div>
          <h2 className={SECTION_TITLE}>קבלת טפסים במייל</h2>
          <p className='mt-2 text-sm text-taupe'>
            פניות מטופס יצירת הקשר באתר יישלחו לכתובת הזו. כדי לשלוח אותן, האתר
            משתמש בחשבון מייל שלכם.
          </p>
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          <div className='space-y-1.5'>
            <label htmlFor='mail-leads' className={LABEL}>
              מייל לקבלת טפסים
            </label>
            <Input
              id='mail-leads'
              type='email'
              dir='ltr'
              className='text-right'
              maxLength={200}
              value={leadsEmail}
              onChange={(e) => setLeadsEmail(e.target.value)}
            />
            <p className='text-xs text-taupe'>לא מוצג באתר. ריק = נשלח למייל הציבורי מפרטי הקשר.</p>
          </div>

          <fieldset className='space-y-1.5'>
            <legend className={cn(LABEL, 'mb-1.5')}>החשבון ששולח את המיילים</legend>
            <div className='flex flex-wrap gap-2'>
              {SMTP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type='button'
                  aria-pressed={preset === p.id}
                  onClick={() => choosePreset(p.id)}
                  className={cn(
                    'min-h-11 border px-4 text-[15px] transition-colors',
                    preset === p.id ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className='space-y-1.5'>
            <label htmlFor='mail-user' className={LABEL}>
              כתובת המייל השולחת
            </label>
            <Input
              id='mail-user'
              type='email'
              dir='ltr'
              className='text-right'
              autoComplete='off'
              maxLength={200}
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <label htmlFor='mail-pass' className={LABEL}>
              {isGmail ? 'סיסמת אפליקציה' : 'סיסמה'}
            </label>
            <Input
              id='mail-pass'
              type='password'
              dir='ltr'
              className='text-right'
              autoComplete='new-password'
              maxLength={500}
              placeholder={smtp.hasPassword ? 'שמורה. הזינו רק כדי להחליף' : ''}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            {isGmail && (
              <p className='text-xs leading-relaxed text-taupe'>
                ב-Gmail לא משתמשים בסיסמה הרגילה. יוצרים סיסמת אפליקציה בחשבון
                Google (נדרש אימות דו-שלבי):{' '}
                <a
                  href='https://myaccount.google.com/apppasswords'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline hover:text-ink'
                >
                  יצירת סיסמת אפליקציה
                </a>
                .
              </p>
            )}
          </div>

          {preset === 'other' && (
            <>
              <div className='space-y-1.5'>
                <label htmlFor='mail-host' className={LABEL}>
                  שרת SMTP
                </label>
                <Input
                  id='mail-host'
                  dir='ltr'
                  className='text-right'
                  placeholder='smtp.example.com'
                  maxLength={200}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                />
              </div>
              <div className='space-y-1.5'>
                <label htmlFor='mail-port' className={LABEL}>
                  פורט
                </label>
                <Input
                  id='mail-port'
                  type='number'
                  dir='ltr'
                  className='text-right'
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className='flex flex-wrap justify-end gap-3 border-t border-line pt-5'>
          <Button
            type='button'
            variant='outline'
            size='lg'
            disabled={isTesting || isSaving}
            onClick={handleTest}
          >
            {isTesting ? 'שולח…' : 'שליחת מייל בדיקה'}
          </Button>
          <Button type='submit' size='lg' disabled={isSaving}>
            {isSaving ? 'שומר…' : 'שמירת הגדרות מייל'}
          </Button>
        </div>
      </Card>
    </form>
  );
}

/** The hero videos played one after another (the first is the one above). */
function HeroSequence({
  clips,
  onAdd,
  onRemove,
  onError,
}: {
  clips: string[];
  onAdd: (file: File, onProgress: (percent: number) => void) => Promise<void>;
  onRemove: (clip: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      onError(`הקובץ גדול מדי (עד ${MAX_UPLOAD_MB}MB).`);
      return;
    }
    setProgress(0);
    try {
      await onAdd(file, setProgress);
    } catch (err) {
      onError(errorMessage(err, 'ההעלאה נכשלה. אפשר להוסיף לרצף רק סרטונים.'));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className='space-y-3 border-t border-line pt-4'>
      <p className={LABEL}>סרטונים ברצף ({clips.length})</p>
      <p className='-mt-2 text-xs text-taupe'>
        מתנגנים אחד אחרי השני במעבר רך, ואז חוזרים להתחלה.
      </p>
      <ol className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
        {clips.map((clip, index) => (
          <li key={clip} className='relative aspect-video overflow-hidden bg-[#E6E0D6]'>
            <video src={mediaUrl(clip)} muted preload='metadata' className='h-full w-full object-cover' />
            <span className='absolute right-1.5 top-1.5 bg-white/90 px-1.5 text-xs tabular-nums'>
              {index + 1}
            </span>
            {index > 0 && (
              <button
                type='button'
                onClick={() => onRemove(clip).catch(() => onError('ההסרה נכשלה.'))}
                aria-label={`הסרת סרטון ${index + 1} מהרצף`}
                className='absolute bottom-1.5 left-1.5 bg-white/90 px-2 py-1 text-xs font-semibold hover:bg-white'
              >
                הסרה
              </button>
            )}
          </li>
        ))}
      </ol>
      {progress !== null && (
        <div className='h-1 bg-line'>
          <div className='h-full bg-ink transition-all' style={{ width: `${progress}%` }} />
        </div>
      )}
      <input
        ref={inputRef}
        type='file'
        accept={VIDEO_TYPES}
        className='sr-only'
        tabIndex={-1}
        aria-hidden='true'
        onChange={handleFile}
      />
      {clips.length < 5 && (
        <Button
          type='button'
          variant='outline'
          disabled={progress !== null}
          onClick={() => inputRef.current?.click()}
        >
          {progress !== null ? `מעלה… ${progress}%` : 'הוספת סרטון לרצף'}
        </Button>
      )}
    </div>
  );
}
