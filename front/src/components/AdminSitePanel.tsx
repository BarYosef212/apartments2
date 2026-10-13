import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
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

const CONTACT_FIELDS: { key: keyof SiteContact; label: string; type?: string; ltr?: boolean }[] = [
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
};

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string })?.message;
    if (message) return SERVER_MESSAGES[message] ?? message;
  }
  return fallback;
}

export function AdminSitePanel() {
  const { fetchSettings, saveSettings, uploadMedia } = useSiteAdminApi();
  const { setSettings: publish } = useSiteSettings();

  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [texts, setTexts] = useState<SiteTexts | null>(null);
  const [contact, setContact] = useState<SiteContact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(applySaved)
      .catch((err) => setError(errorMessage(err, 'שגיאה בטעינת הגדרות האתר.')));
  }, []);

  function applySaved(settings: SiteSettings) {
    setSaved(settings);
    setTexts(settings.texts);
    setContact(settings.contact);
    publish(settings);
  }

  async function save(update: SiteSettingsUpdate, successMessage: string) {
    setError(null);
    setNotice(null);
    const next = await saveSettings(update);
    applySaved(next);
    setNotice(successMessage);
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!texts || !contact) return;
    setIsSaving(true);
    try {
      await save({ texts, contact }, 'הטקסטים ופרטי הקשר נשמרו.');
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

  const isDirty =
    JSON.stringify({ texts, contact }) !==
    JSON.stringify({ texts: saved.texts, contact: saved.contact });

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
            await save({ heroMedia: { kind, url } }, 'המדיה בעמוד הבית עודכנה.');
          }}
          onClear={() => save({ heroMedia: { kind: 'image', url: '' } }, 'חזרה לתמונה אוטומטית.')}
          onError={setError}
        />
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
                value={contact[field.key]}
                onChange={(e) => setContact({ ...contact, [field.key]: e.target.value })}
              />
            </div>
          ))}
          <div className='mt-auto flex justify-end pt-4'>
            <Button type='submit' size='lg' disabled={!isDirty || isSaving}>
              {isSaving ? 'שומר…' : 'שמירת טקסטים ופרטי קשר'}
            </Button>
          </div>
        </Card>
      </form>
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
}: {
  title: string;
  description: string;
  accept: string;
  current: { kind: 'image' | 'video'; url: string } | null;
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<void>;
  onClear: () => Promise<void>;
  onError: (message: string) => void;
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
    </Card>
  );
}
