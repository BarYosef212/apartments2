import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Check, Copy, Download, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '../api/api';
import { Button, Card, Input } from './ui';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { formatPrice, mediaUrl, sizedImage } from '../lib/format';
import { pickVariant, POST_PLACEHOLDERS, renderPost, templateVariants } from '../lib/facebookPost';
import { ExtensionResult, useGroupExtension } from '../hooks/useGroupExtension';
import { Apartment } from '../types/apartment.types';
import { FacebookPageCard } from './FacebookPageCard';
import { FacebookQueueCard } from './FacebookQueueCard';
import Switch from './ui/switch';

type GroupDealType = 'sale' | 'rent' | 'any';

interface Group {
  _id: string;
  name: string;
  url: string;
  dealType?: GroupDealType;
  city?: string;
}

const GROUP_DEAL_LABELS: Record<GroupDealType, string> = {
  rent: 'השכרה',
  sale: 'מכירה',
  any: 'מכירה והשכרה',
};

interface PagePost {
  apartmentId: string;
  postId: string | null;
  postedAt: string | null;
  error: string | null;
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

/**
 * Copies synchronously, inside the click. The async Clipboard API can still
 * be pending when the Facebook tab opens and takes focus, and then it fails.
 */
function copyNow(text: string) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  if (!ok) navigator.clipboard?.writeText(text).catch(() => {});
  return ok;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

export function AdminFacebookPanel() {
  const contact = useSiteSettings().settings?.contact;
  const phone = contact?.phone;
  const license = contact?.license;

  const [groups, setGroups] = useState<Group[]>([]);
  const [posts, setPosts] = useState<Map<string, Post>>(new Map());
  const [pagePosts, setPagePosts] = useState<Map<string, PagePost>>(new Map());
  const [pageReady, setPageReady] = useState(false);
  const [pagePublishing, setPagePublishing] = useState<string | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [template, setTemplate] = useState('');
  const [savedTemplate, setSavedTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const [publishing, setPublishing] = useState<{
    apartment: Apartment;
    group: Group;
    copied: boolean;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Group[]>('/admin/facebook/groups'),
      api.get<Post[]>('/admin/facebook/posts'),
      api.get<{ template: string }>('/admin/facebook/template'),
      api.get<{ results: Apartment[] }>('/apartments', { params: { page: 1, limit: 200 } }),
      api.get<PagePost[]>('/admin/facebook/page/posts'),
    ])
      .then(([g, p, t, a, pp]) => {
        setPagePosts(new Map(pp.data.map((post) => [post.apartmentId, post])));
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

  // Each group gets its own version of the text (when there are several).
  const textFor = (apartment: Apartment, group?: Group) =>
    renderPost(pickVariant(savedTemplate, `${apartment._id}:${group?._id ?? ''}`), apartment, {
      phone,
      license,
      siteOrigin: window.location.origin,
    });

  // Fills in progress through the extension, by job id.
  const jobs = useRef(new Map<string, { apartment: Apartment; group: Group }>());
  const extension = useGroupExtension((jobId, result) => {
    const job = jobs.current.get(jobId);
    if (!job) return;
    handleExtensionResult(job.apartment, job.group, result);
    if (result.status !== 'filled') jobs.current.delete(jobId);
  });

  function handleExtensionResult(apartment: Apartment, group: Group, result: ExtensionResult) {
    const when = (ms?: number) =>
      ms ? new Date(ms).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
    switch (result.status) {
      case 'filled':
        flash(
          result.textOk
            ? `הפוסט מולא בקבוצה ״${group.name}״${result.imagesAdded ? ` עם ${result.imagesAdded} תמונות` : ''}. בדקו ולחצו ״פרסום״ בפייסבוק.`
            : `הקבוצה נפתחה, אבל הטקסט לא נכנס. הוא הועתק: הדביקו אותו ידנית.`,
        );
        break;
      case 'posted':
        markPosted(apartment, group);
        break;
      case 'limit':
        setError(
          result.reason === 'daily_cap'
            ? `הגעתם למכסה של ${result.cap} קבוצות להיום. אפשר להמשיך מחר.`
            : result.reason === 'paused'
              ? `הפרסום בקבוצות מושהה עד ${when(result.until)} בגלל אזהרה מפייסבוק.`
              : `כדי לא להיראות כמו מכונה, הקבוצה הבאה אפשרית מ־${when(result.until)}.`,
        );
        break;
      default:
        setError(result.message ?? 'משהו השתבש בתוסף.');
    }
  }

  function imageUrlsFor(apartment: Apartment) {
    const images = apartment.images?.length ? apartment.images : apartment.img ? [apartment.img] : [];
    return images.map((url) => mediaUrl(sizedImage(url, 1600)));
  }

  function copyText(apartment: Apartment) {
    if (copyNow(textFor(apartment))) flash(`הטקסט של ${apartment.street} הועתק.`);
    else setError('לא הצלחנו להעתיק. פתחו ״הצגת הטקסט״, סמנו והעתיקו ידנית.');
  }

  /**
   * With the extension: it opens the group and fills the post. Without it:
   * copy the text, open the group, and walk through the rest.
   */
  function postToGroup(apartment: Apartment, group: Group) {
    if (extension.installed) {
      const jobId = `${apartment._id}:${group._id}:${Date.now()}`;
      jobs.current.set(jobId, { apartment, group });
      setError(null);
      flash(`פותח את ״${group.name}״ וממלא את הפוסט…`);
      extension.fillGroup({
        jobId,
        groupUrl: group.url,
        text: textFor(apartment, group),
        images: imageUrlsFor(apartment),
      });
      return;
    }
    const copied = copyNow(textFor(apartment, group));
    window.open(group.url, '_blank', 'noopener,noreferrer');
    setError(null);
    setNotice(null);
    setPublishing({ apartment, group, copied });
  }

  async function markPosted(apartment: Apartment, group: Group) {
    try {
      const res = await api.post<Post>('/admin/facebook/posts', {
        apartmentId: apartment._id,
        groupId: group._id,
      });
      setPosts((m) => new Map(m).set(postKey(apartment._id, group._id), res.data));
      setPublishing(null);
      flash(`סומן: ${apartment.street} פורסם ב״${group.name}״.`);
    } catch {
      setError('הסימון נכשל.');
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

  async function publishToPage(apartment: Apartment) {
    setPagePublishing(apartment._id);
    try {
      const res = await api.post<PagePost>('/admin/facebook/page/posts', { apartmentId: apartment._id });
      setPagePosts((m) => new Map(m).set(apartment._id, res.data));
      flash(`${apartment.street} פורסם בעמוד העסקי.`);
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string })?.detail
        : undefined;
      setError(detail ? `הפרסום לעמוד נכשל: ${detail}` : 'הפרסום לעמוד נכשל.');
    } finally {
      setPagePublishing(null);
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

      <FacebookPageCard onReadyChange={setPageReady} onNotice={flash} onError={setError} />

      <FacebookQueueCard
        extensionInstalled={extension.installed}
        connectExtension={extension.connectQueue}
        onNotice={flash}
        onError={setError}
      />

      <div className='grid gap-6 lg:grid-cols-2'>
        <GroupsCard
          groups={groups}
          cities={[...new Set(apartments.map((a) => a.city))].sort()}
          onChange={(group) => setGroups((g) => g.map((x) => (x._id === group._id ? group : x)))}
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
          preview={
            apartments[0]
              ? templateVariants(template)
                  .map((v) => renderPost(v, apartments[0], { phone, license, siteOrigin: window.location.origin }))
                  .join('\n\n— נוסח נוסף —\n\n')
              : ''
          }
        />
      </div>

      <Card className='overflow-hidden'>
        <div className='flex flex-wrap items-center justify-between gap-4 border-b border-line p-6'>
          <div>
            <h2 className={SECTION_TITLE}>פרסום נכסים</h2>
            {extension.installed && extension.info ? (
              <p className='mt-2 text-sm text-taupe'>
                <span className='font-semibold text-emerald-800'>התוסף מחובר.</span> לחיצה על
                קבוצה פותחת אותה וממלאת את הפוסט עם התמונות. היום:{' '}
                {extension.info.count} מתוך {extension.info.settings.dailyCap} קבוצות.
                {extension.info.settings.devMode && (
                  <span className='mr-2 font-semibold text-red-700'>
                    מצב פיתוח פעיל: אין המתנה ואין מכסה. בטלו אותו בתוסף לפני פרסום אמיתי.
                  </span>
                )}
              </p>
            ) : (
              <p className='mt-2 text-sm text-taupe'>
                לחיצה על קבוצה מעתיקה את הטקסט ופותחת את הקבוצה. עם תוסף הכרום של האתר,
                הפוסט ימולא לבד עם התמונות.
              </p>
            )}
          </div>
          <label className='flex min-h-11 cursor-pointer items-center gap-3 text-sm'>
            <Switch checked={onlyPending} onCheckedChange={setOnlyPending} />
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
              pageReady={pageReady}
              pagePost={pagePosts.get(apartment._id)}
              pagePublishing={pagePublishing === apartment._id}
              onPublishPage={() => publishToPage(apartment)}
            />
          ))}
        </ul>
      </Card>

      {publishing && (
        <PublishDialog
          {...publishing}
          text={textFor(publishing.apartment, publishing.group)}
          onCopyAgain={() =>
            setPublishing({ ...publishing, copied: copyNow(textFor(publishing.apartment, publishing.group)) })
          }
          onDownload={() => downloadImages(publishing.apartment)}
          onDone={() => markPosted(publishing.apartment, publishing.group)}
          onClose={() => setPublishing(null)}
        />
      )}
    </div>
  );
}

/** Stays open in the admin while the group is open in another tab. */
function PublishDialog({
  apartment,
  group,
  copied,
  text,
  onCopyAgain,
  onDownload,
  onDone,
  onClose,
}: {
  apartment: Apartment;
  group: Group;
  copied: boolean;
  text: string;
  onCopyAgain: () => void;
  onDownload: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const hasImages = (apartment.images?.length ?? 0) > 0 || !!apartment.img;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const step = 'flex gap-4';
  const num =
    'flex h-8 w-8 shrink-0 items-center justify-center border border-ink font-display text-xl leading-none';

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={onClose}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='publish-title'
        className='max-h-[90vh] w-full max-w-xl overflow-y-auto bg-white p-7'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id='publish-title' className='font-display text-4xl font-light leading-none'>
          פרסום ב״{group.name}״
        </h2>
        <p className='mt-2 text-sm text-taupe'>
          {apartment.street}, {apartment.city}. הקבוצה נפתחה בלשונית חדשה.
        </p>

        <ol className='mt-7 space-y-5 text-[15px]'>
          <li className={step}>
            <span className={num}>1</span>
            <div className='pt-1'>
              {copied ? (
                <p className='flex items-center gap-2'>
                  <Check className='h-4 w-4 text-emerald-700' aria-hidden='true' /> הטקסט הועתק.
                </p>
              ) : (
                <p className='text-red-700'>ההעתקה האוטומטית לא עבדה. לחצו ״העתקה שוב״.</p>
              )}
              <button type='button' onClick={onCopyAgain} className='mt-1 text-sm underline'>
                העתקה שוב
              </button>
            </div>
          </li>
          <li className={step}>
            <span className={num}>2</span>
            <p className='pt-1'>בקבוצה, לחצו על ״כתבו משהו…״ כדי לפתוח פוסט חדש.</p>
          </li>
          <li className={step}>
            <span className={num}>3</span>
            <p className='pt-1'>
              הדביקו את הטקסט:{' '}
              <kbd className='border border-line bg-sand px-1.5 py-0.5 text-sm' dir='ltr'>
                {isMac ? '⌘ V' : 'Ctrl V'}
              </kbd>
            </p>
          </li>
          {hasImages && (
            <li className={step}>
              <span className={num}>4</span>
              <div className='pt-1'>
                <p>
                  צרפו תמונות: הורידו אותן, פתחו את הקובץ שירד, ובפוסט לחצו ״תמונה/סרטון״
                  ובחרו אותן.
                </p>
                <button
                  type='button'
                  onClick={onDownload}
                  className='mt-2 inline-flex min-h-10 items-center gap-2 border border-ink px-3 text-sm font-semibold hover:bg-ink hover:text-white'
                >
                  <Download className='h-4 w-4' aria-hidden='true' /> הורדת התמונות
                </button>
              </div>
            </li>
          )}
          <li className={step}>
            <span className={num}>{hasImages ? 5 : 4}</span>
            <p className='pt-1'>לחצו ״פרסום״ בפייסבוק, וחזרו לכאן לסמן שפורסם.</p>
          </li>
        </ol>

        <details className='mt-6 text-sm'>
          <summary className='cursor-pointer text-taupe hover:text-ink'>הטקסט שהועתק</summary>
          <pre className='mt-2 whitespace-pre-wrap border border-line bg-sand p-3 font-sans leading-relaxed'>
            {text}
          </pre>
        </details>

        <div className='mt-7 flex flex-wrap justify-between gap-3 border-t border-line pt-5'>
          <a
            href={group.url}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex min-h-11 items-center gap-1.5 text-sm underline'
          >
            פתיחת הקבוצה שוב <ExternalLink className='h-3.5 w-3.5' aria-hidden='true' />
          </a>
          <div className='flex gap-3'>
            <Button type='button' variant='outline' onClick={onClose}>
              עוד לא
            </Button>
            <Button type='button' onClick={onDone}>
              פרסמתי
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupsCard({
  groups,
  onAdd,
  onDelete,
  onError,
  onChange,
  cities,
}: {
  groups: Group[];
  cities: string[];
  onChange: (group: Group) => void;
  onAdd: (group: Group) => void;
  onDelete: (group: Group) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  async function setGroupField(group: Group, change: { dealType?: GroupDealType; city?: string }) {
    try {
      const res = await api.patch<Group>(`/admin/facebook/groups/${group._id}`, change);
      onChange(res.data);
    } catch {
      onError('שינוי סוג הקבוצה נכשל.');
    }
  }

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
            <li key={group._id} className='flex flex-wrap items-center gap-2 py-2.5'>
              <a
                href={group.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex min-w-0 flex-1 basis-full items-center gap-2 hover:underline sm:basis-auto'
              >
                <span className='truncate'>{group.name}</span>
                <ExternalLink className='h-3.5 w-3.5 shrink-0 text-taupe' aria-hidden='true' />
              </a>
              <select
                aria-label={`סוג הנכסים בקבוצה ${group.name}`}
                value={group.dealType ?? 'any'}
                onChange={(e) => setGroupField(group, { dealType: e.target.value as GroupDealType })}
                className='mr-auto h-9 shrink-0 border border-line bg-white px-2 text-sm'
              >
                {(Object.keys(GROUP_DEAL_LABELS) as GroupDealType[]).map((k) => (
                  <option key={k} value={k}>
                    {GROUP_DEAL_LABELS[k]}
                  </option>
                ))}
              </select>
              <select
                aria-label={`העיר של הקבוצה ${group.name}`}
                value={group.city ?? ''}
                onChange={(e) => setGroupField(group, { city: e.target.value })}
                className='h-9 max-w-[9rem] shrink-0 border border-line bg-white px-2 text-sm'
              >
                <option value=''>כל הערים</option>
                {[...new Set([...cities, ...(group.city ? [group.city] : [])])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
          הטקסט שיועתק לכל נכס. שורה שאין לה ערך (למשל בלי קומה) לא תופיע. אפשר לכתוב
          כמה נוסחים, מופרדים בשורה שיש בה רק <code dir='ltr'>---</code>, וכל קבוצה תקבל
          נוסח אחר.
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
  pageReady,
  pagePost,
  pagePublishing,
  onPublishPage,
}: {
  pageReady: boolean;
  pagePost?: PagePost;
  pagePublishing: boolean;
  onPublishPage: () => void;
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
          {pageReady &&
            (pagePost?.postId ? (
              <a
                href={`https://www.facebook.com/${pagePost.postId}`}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex min-h-10 items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-900 hover:underline'
              >
                <Check className='h-4 w-4' aria-hidden='true' />
                בעמוד העסקי{pagePost.postedAt ? ` · ${formatDate(pagePost.postedAt)}` : ''}
              </a>
            ) : (
              <button
                type='button'
                onClick={onPublishPage}
                disabled={pagePublishing}
                title={pagePost?.error ? `ניסיון קודם נכשל: ${pagePost.error}` : undefined}
                className='inline-flex min-h-10 items-center gap-2 bg-ink px-3 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50'
              >
                {pagePublishing ? 'מפרסם…' : pagePost?.error ? 'פרסום לעמוד (נכשל, שוב)' : 'פרסום לעמוד העסקי'}
              </button>
            ))}
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
