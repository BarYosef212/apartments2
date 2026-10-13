import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Check, Copy, Download, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '../api/api';
import { Button, Card, Input } from './ui';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { formatPrice, sizedImage } from '../lib/format';
import { POST_PLACEHOLDERS, renderPost } from '../lib/facebookPost';
import { Apartment } from '../types/apartment.types';

interface Group {
  _id: string;
  name: string;
  url: string;
}

interface Post {
  apartmentId: string;
  groupId: string;
  postedAt: string;
}

const SECTION_TITLE = 'font-display text-3xl font-light leading-none';
const LABEL = 'text-sm font-medium';

const SERVER_MESSAGES: Record<string, string> = {
  'Invalid group URL': 'הקישור צריך להיות לקבוצת פייסבוק, למשל https://www.facebook.com/groups/…',
  'Invalid name': 'נא לתת שם לקבוצה.',
  'Invalid template': 'התבנית ריקה או ארוכה מדי.',
};

function errorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string })?.message;
    if (message) return SERVER_MESSAGES[message] ?? fallback;
  }
  return fallback;
}

const postKey = (apartmentId: string, groupId: string) => `${apartmentId}:${groupId}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

export function AdminFacebookPanel() {
  const phone = useSiteSettings().settings?.contact.phone;

  const [groups, setGroups] = useState<Group[]>([]);
  const [posts, setPosts] = useState<Map<string, Post>>(new Map());
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [template, setTemplate] = useState('');
  const [savedTemplate, setSavedTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Group[]>('/admin/facebook/groups'),
      api.get<Post[]>('/admin/facebook/posts'),
      api.get<{ template: string }>('/admin/facebook/template'),
      api.get<{ results: Apartment[] }>('/apartments', { params: { page: 1, limit: 200 } }),
    ])
      .then(([g, p, t, a]) => {
        setGroups(g.data);
        setPosts(new Map(p.data.map((post) => [postKey(post.apartmentId, post.groupId), post])));
        setTemplate(t.data.template);
        setSavedTemplate(t.data.template);
        setApartments(a.data.results);
      })
      .catch(() => setError('שגיאה בטעינת נתוני הפייסבוק.'))
      .finally(() => setIsLoading(false));
  }, []);

  function flash(message: string) {
    setError(null);
    setNotice(message);
  }

  const textFor = (apartment: Apartment) =>
    renderPost(savedTemplate, apartment, { phone, siteOrigin: window.location.origin });

  async function copyText(apartment: Apartment) {
    try {
      await navigator.clipboard.writeText(textFor(apartment));
      flash(`הטקסט של ${apartment.street} הועתק.`);
    } catch {
      setError('לא הצלחנו להעתיק. אפשר לסמן את הטקסט בתצוגה ולהעתיק ידנית.');
    }
  }

  async function postToGroup(apartment: Apartment, group: Group) {
    // Start the copy before opening the tab: the clipboard needs this page focused.
    const copied = navigator.clipboard.writeText(textFor(apartment));
    window.open(group.url, '_blank', 'noopener,noreferrer');
    try {
      await copied;
      const res = await api.post<Post>('/admin/facebook/posts', {
        apartmentId: apartment._id,
        groupId: group._id,
      });
      setPosts((m) => new Map(m).set(postKey(apartment._id, group._id), res.data));
      flash(`הטקסט הועתק והקבוצה ״${group.name}״ נפתחה. הדביקו (Ctrl+V / ⌘V), צרפו את התמונות ופרסמו.`);
    } catch {
      setError('הקבוצה נפתחה, אבל ההעתקה או הסימון נכשלו. נסו ״העתקת טקסט״.');
    }
  }

  async function unmark(apartment: Apartment, group: Group) {
    try {
      await api.delete('/admin/facebook/posts', {
        data: { apartmentId: apartment._id, groupId: group._id },
      });
      setPosts((m) => {
        const next = new Map(m);
        next.delete(postKey(apartment._id, group._id));
        return next;
      });
    } catch {
      setError('ביטול הסימון נכשל.');
    }
  }

  async function downloadImages(apartment: Apartment) {
    try {
      const res = await api.get<Blob>(`/admin/facebook/apartments/${apartment._id}/images.zip`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${apartment.street} ${apartment.city}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('הורדת התמונות נכשלה.');
    }
  }

  async function saveTemplate() {
    try {
      const res = await api.put<{ template: string }>('/admin/facebook/template', { template });
      setSavedTemplate(res.data.template);
      flash('תבנית הפוסט נשמרה.');
    } catch (err) {
      setError(errorMessage(err, 'שמירת התבנית נכשלה.'));
    }
  }

  const pendingCount = (apartment: Apartment) =>
    groups.filter((g) => !posts.has(postKey(apartment._id, g._id))).length;

  const shown = useMemo(
    () => (onlyPending ? apartments.filter((a) => pendingCount(a) > 0) : apartments),
    [apartments, onlyPending, groups, posts],
  );

  if (isLoading) {
    return <div className='animate-pulse py-16 text-center text-sm text-taupe'>טוען…</div>;
  }

  return (
    <div className='space-y-6'>
      {error && (
        <p role='alert' className='border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </p>
      )}
      {notice && !error && (
        <p role='status' className='border border-line bg-white p-3 text-sm'>
          {notice}
        </p>
      )}

      <div className='grid gap-6 lg:grid-cols-2'>
        <GroupsCard
          groups={groups}
          onAdd={(group) => {
            setGroups((g) => [...g, group]);
            flash(`הקבוצה ״${group.name}״ נוספה.`);
          }}
          onDelete={async (group) => {
            try {
              await api.delete(`/admin/facebook/groups/${group._id}`);
              setGroups((g) => g.filter((x) => x._id !== group._id));
              flash(`הקבוצה ״${group.name}״ הוסרה.`);
            } catch {
              setError('הסרת הקבוצה נכשלה.');
            }
          }}
          onError={setError}
        />
        <TemplateCard
          template={template}
          isDirty={template !== savedTemplate}
          onChange={setTemplate}
          onSave={saveTemplate}
          preview={apartments[0] ? renderPost(template, apartments[0], { phone, siteOrigin: window.location.origin }) : ''}
        />
      </div>

      <Card className='overflow-hidden'>
        <div className='flex flex-wrap items-center justify-between gap-4 border-b border-line p-6'>
          <div>
            <h2 className={SECTION_TITLE}>פרסום נכסים</h2>
            <p className='mt-2 text-sm text-taupe'>
              לחיצה על קבוצה מעתיקה את הטקסט, פותחת את הקבוצה ומסמנת שפורסם. שם
              מדביקים, מצרפים את התמונות ולוחצים ״פרסום״.
            </p>
          </div>
          <label className='flex min-h-11 cursor-pointer items-center gap-2.5 text-sm'>
            <input
              type='checkbox'
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className='h-4 w-4 accent-ink'
            />
            רק נכסים שטרם פורסמו בכל הקבוצות
          </label>
        </div>

        {groups.length === 0 && (
          <p className='border-b border-line bg-sand p-4 text-sm text-taupe'>
            הוסיפו קודם קבוצה אחת לפחות כדי לפרסם.
          </p>
        )}

        <ul className='divide-y divide-line'>
          {shown.length === 0 && (
            <li className='p-10 text-center text-taupe'>
              {onlyPending ? 'כל הנכסים פורסמו בכל הקבוצות.' : 'אין נכסים.'}
            </li>
          )}
          {shown.map((apartment) => (
            <ListingRow
              key={apartment._id}
              apartment={apartment}
              groups={groups}
              posts={posts}
              text={textFor(apartment)}
              onCopy={() => copyText(apartment)}
              onDownload={() => downloadImages(apartment)}
              onPost={(group) => postToGroup(apartment, group)}
              onUnmark={(group) => unmark(apartment, group)}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function GroupsCard({
  groups,
  onAdd,
  onDelete,
  onError,
}: {
  groups: Group[];
  onAdd: (group: Group) => void;
  onDelete: (group: Group) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setIsAdding(true);
    try {
      const res = await api.post<Group>('/admin/facebook/groups', { name, url });
      onAdd(res.data);
      setName('');
      setUrl('');
    } catch (err) {
      onError(errorMessage(err, 'הוספת הקבוצה נכשלה.'));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Card className='flex flex-col gap-5 p-6'>
      <h2 className={SECTION_TITLE}>קבוצות פייסבוק</h2>

      {groups.length > 0 ? (
        <ul className='divide-y divide-line border-y border-line'>
          {groups.map((group) => (
            <li key={group._id} className='flex items-center justify-between gap-3 py-2.5'>
              <a
                href={group.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex min-w-0 items-center gap-2 hover:underline'
              >
                <span className='truncate'>{group.name}</span>
                <ExternalLink className='h-3.5 w-3.5 shrink-0 text-taupe' aria-hidden='true' />
              </a>
              <button
                type='button'
                onClick={() => {
                  if (window.confirm(`להסיר את הקבוצה ״${group.name}״?`)) onDelete(group);
                }}
                aria-label={`הסרת הקבוצה ${group.name}`}
                className='flex h-10 w-10 shrink-0 items-center justify-center text-taupe hover:bg-sand hover:text-ink'
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className='text-sm text-taupe'>עדיין לא נוספו קבוצות.</p>
      )}

      <form onSubmit={handleAdd} className='mt-auto space-y-3'>
        <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
          <div className='space-y-1.5'>
            <label htmlFor='fb-group-name' className={LABEL}>
              שם הקבוצה
            </label>
            <Input
              id='fb-group-name'
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <label htmlFor='fb-group-url' className={LABEL}>
              קישור לקבוצה
            </label>
            <Input
              id='fb-group-url'
              type='url'
              dir='ltr'
              className='text-right'
              required
              placeholder='https://www.facebook.com/groups/…'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>
        <div className='flex justify-end'>
          <Button type='submit' disabled={isAdding}>
            {isAdding ? 'מוסיף…' : 'הוספת קבוצה'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TemplateCard({
  template,
  isDirty,
  onChange,
  onSave,
  preview,
}: {
  template: string;
  isDirty: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  preview: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Inserts a placeholder at the cursor.
  function insert(key: string) {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) return onChange(template + token);
    const { selectionStart: start, selectionEnd: end } = el;
    onChange(template.slice(0, start) + token + template.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <Card className='flex flex-col gap-4 p-6'>
      <div>
        <h2 className={SECTION_TITLE}>תבנית הפוסט</h2>
        <p className='mt-2 text-sm text-taupe'>
          הטקסט שיועתק לכל נכס. שורה שאין לה ערך (למשל בלי קומה) לא תופיע.
        </p>
      </div>
      <div className='flex flex-wrap gap-1.5'>
        {POST_PLACEHOLDERS.map((p) => (
          <button
            key={p.key}
            type='button'
            title={p.label}
            onClick={() => insert(p.key)}
            className='min-h-8 border border-line bg-sand px-2.5 text-xs hover:border-ink'
          >
            {`{${p.key}}`}
          </button>
        ))}
      </div>
      <label htmlFor='fb-template' className='sr-only'>
        תבנית הפוסט
      </label>
      {showPreview ? (
        <pre className='min-h-[220px] whitespace-pre-wrap border border-line bg-white p-3.5 font-sans text-[15px] leading-relaxed'>
          {preview || 'אין נכסים לתצוגה.'}
        </pre>
      ) : (
        <textarea
          id='fb-template'
          ref={ref}
          rows={10}
          maxLength={3000}
          value={template}
          onChange={(e) => onChange(e.target.value)}
          className='w-full border border-line bg-white px-3.5 py-2.5 text-[15px] leading-relaxed focus-visible:border-ink focus-visible:outline-none'
        />
      )}
      <div className='flex flex-wrap justify-end gap-3'>
        <Button type='button' variant='outline' onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'חזרה לעריכה' : 'תצוגה מקדימה'}
        </Button>
        <Button type='button' onClick={onSave} disabled={!isDirty}>
          שמירת תבנית
        </Button>
      </div>
    </Card>
  );
}

function ListingRow({
  apartment,
  groups,
  posts,
  text,
  onCopy,
  onDownload,
  onPost,
  onUnmark,
}: {
  apartment: Apartment;
  groups: Group[];
  posts: Map<string, Post>;
  text: string;
  onCopy: () => void;
  onDownload: () => void;
  onPost: (group: Group) => void;
  onUnmark: (group: Group) => void;
}) {
  const [open, setOpen] = useState(false);
  const imageCount = apartment.images?.length || (apartment.img ? 1 : 0);

  return (
    <li className='p-5'>
      <div className='flex flex-wrap items-start gap-5'>
        <div className='h-20 w-28 shrink-0 overflow-hidden bg-[#E6E0D6]'>
          {apartment.img && (
            <img src={sizedImage(apartment.img, 800)} alt='' className='h-full w-full object-cover' />
          )}
        </div>

        <div className='min-w-[180px] flex-1'>
          <p className='font-display text-3xl font-light leading-none'>{apartment.street}</p>
          <p className='mt-1 text-sm text-[#4A463F]'>
            {apartment.city} · {formatPrice(apartment.price)}
          </p>
          <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm'>
            <button type='button' onClick={onCopy} className='inline-flex min-h-9 items-center gap-1.5 hover:underline'>
              <Copy className='h-4 w-4' aria-hidden='true' /> העתקת טקסט
            </button>
            {imageCount > 0 && (
              <button type='button' onClick={onDownload} className='inline-flex min-h-9 items-center gap-1.5 hover:underline'>
                <Download className='h-4 w-4' aria-hidden='true' /> הורדת {imageCount} תמונות
              </button>
            )}
            <button
              type='button'
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className='inline-flex min-h-9 items-center text-taupe hover:text-ink hover:underline'
            >
              {open ? 'הסתרת הטקסט' : 'הצגת הטקסט'}
            </button>
          </div>
        </div>

        <div className='flex w-full flex-wrap gap-2 lg:w-auto lg:max-w-[50%] lg:justify-end'>
          {groups.map((group) => {
            const post = posts.get(postKey(apartment._id, group._id));
            return post ? (
              <span
                key={group._id}
                className='inline-flex min-h-10 items-center gap-2 border border-line bg-sand px-3 text-sm'
              >
                <Check className='h-4 w-4 text-emerald-700' aria-hidden='true' />
                {group.name} · {formatDate(post.postedAt)}
                <button
                  type='button'
                  onClick={() => onUnmark(group)}
                  className='text-xs text-taupe underline hover:text-ink'
                  aria-label={`ביטול הסימון שפורסם ב${group.name}`}
                >
                  ביטול
                </button>
              </span>
            ) : (
              <button
                key={group._id}
                type='button'
                onClick={() => onPost(group)}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 border border-ink px-3 text-sm font-semibold transition-colors hover:bg-ink hover:text-white',
                )}
              >
                פרסום ב{group.name}
                <ExternalLink className='h-3.5 w-3.5' aria-hidden='true' />
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <pre className='mt-4 whitespace-pre-wrap border border-line bg-sand p-4 font-sans text-[15px] leading-relaxed'>
          {text}
        </pre>
      )}
    </li>
  );
}
