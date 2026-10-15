import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { api } from '../api/api';
import { Button, Input } from '../components/ui';
import { useApartmentsApi } from '../hooks/useApartmentsApi';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { sizedImage, whatsappUrl } from '../lib/format';
import { Apartment } from '../types/apartment.types';

type Reason = 'viewing' | 'valuation' | 'general';

const REASONS: { value: Reason; label: string }[] = [
  { value: 'viewing', label: 'תיאום ביקור בנכס' },
  { value: 'valuation', label: 'מכירה או השכרה של נכס' },
  { value: 'general', label: 'שאלה כללית' },
];

const HEADINGS: Record<Reason, { title: string; subtitle: string }> = {
  viewing: {
    title: 'תיאום ביקור',
    subtitle: 'השאירו פרטים ונחזור אליכם לתאם מועד שנוח לכם.',
  },
  valuation: {
    title: 'פגישת הערכה',
    subtitle: 'ספרו לנו על הנכס, ונחזור אליכם לתיאום פגישה ללא התחייבות.',
  },
  general: {
    title: 'יצירת קשר',
    subtitle: 'השאירו פרטים ונחזור אליכם בהקדם.',
  },
};

const SERVER_MESSAGES: Record<string, string> = {
  'Invalid name': 'נא למלא שם מלא.',
  'Invalid phone': 'מספר הטלפון אינו תקין.',
  'Invalid email': 'כתובת האימייל אינה תקינה.',
  'Message is too long': 'ההודעה ארוכה מדי.',
  'Too many requests': 'נשלחו יותר מדי פניות. נסו שוב בעוד כמה דקות.',
};

const LABEL = 'text-sm font-medium';

export function ContactPage() {
  const [searchParams] = useSearchParams();
  const { fetchApartmentsById } = useApartmentsApi();
  const contact = useSiteSettings().settings?.contact;

  const apartmentId = searchParams.get('apartment');
  const initialReason = REASONS.some((r) => r.value === searchParams.get('reason'))
    ? (searchParams.get('reason') as Reason)
    : apartmentId
      ? 'viewing'
      : 'general';

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    reason: initialReason,
    message: '',
    website: '', // honeypot
  });
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apartmentId) return;
    fetchApartmentsById(apartmentId)
      .then(setApartment)
      .catch(() => setApartment(null));
  }, [apartmentId]);

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      await api.post('/leads', {
        ...form,
        apartmentId: form.reason === 'viewing' ? apartment?._id : undefined,
      });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(
        (message && SERVER_MESSAGES[message]) ||
          'השליחה נכשלה. נסו שוב, או צרו קשר בטלפון.',
      );
    } finally {
      setIsSending(false);
    }
  }

  const heading = HEADINGS[form.reason];

  return (
    <div className='mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-10'>
      <div className='grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-24'>
        <div>
          <p className='flex items-center gap-3.5 text-sm font-semibold tracking-[0.08em] text-brass'>
            <span className='block h-px w-8 bg-brass' />
            נשמח לשמוע מכם
          </p>
          <h1 className='mt-4 font-display text-[clamp(60px,7vw,96px)] font-light leading-[0.95]'>
            {sent ? 'תודה!' : heading.title}
          </h1>
          <p className='mt-5 max-w-md text-lg font-light leading-relaxed'>
            {sent ? 'קיבלנו את הפנייה ונחזור אליכם בהקדם.' : heading.subtitle}
          </p>

          {apartment && form.reason === 'viewing' && (
            <Link
              to={`/apartments/${apartment._id}`}
              className='mt-10 flex max-w-md items-center gap-4 bg-white p-3 transition-shadow hover:shadow-[0_12px_30px_rgba(25,25,23,0.10)]'
            >
              {apartment.img && (
                <img
                  src={sizedImage(apartment.img, 800)}
                  alt=''
                  className='h-20 w-28 shrink-0 object-cover'
                />
              )}
              <div className='min-w-0'>
                <p className='text-xs text-taupe'>הפנייה בנוגע לנכס</p>
                <p className='truncate font-display text-3xl font-light leading-tight'>
                  {apartment.street}
                </p>
                <p className='text-sm text-[#4A463F]'>{apartment.city}</p>
              </div>
            </Link>
          )}

          {(contact?.phone || contact?.whatsapp || contact?.email) && (
            <div className='mt-12 space-y-3 border-t border-line pt-8'>
              <p className='text-sm text-taupe'>או ישירות:</p>
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className='block text-lg hover:opacity-70'>
                  טלפון: <span dir='ltr' className='mr-1'>{contact.phone}</span>
                </a>
              )}
              {contact.whatsapp && (
                <a
                  href={whatsappUrl(contact.whatsapp)}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block text-lg hover:opacity-70'
                >
                  וואטסאפ
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className='block break-all text-lg hover:opacity-70'>
                  {contact.email}
                </a>
              )}
            </div>
          )}
        </div>

        {sent ? (
          <div className='flex flex-col items-start justify-center gap-6 bg-white p-8 md:p-12'>
            <p className='text-lg'>הפרטים נשלחו בהצלחה.</p>
            <div className='flex flex-wrap gap-3'>
              <Button asChild size='lg'>
                <Link to='/apartments'>לכל הנכסים</Link>
              </Button>
              <Button asChild size='lg' variant='outline'>
                <Link to='/'>לעמוד הבית</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-6 bg-white p-8 md:p-12' noValidate={false}>
            <fieldset className='space-y-2.5'>
              <legend className={cn(LABEL, 'mb-2.5')}>במה נוכל לעזור?</legend>
              <div className='flex flex-wrap gap-2'>
                {REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center border px-4 text-[15px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink',
                      form.reason === r.value
                        ? 'border-ink bg-ink text-white'
                        : 'border-line hover:border-ink',
                    )}
                  >
                    <input
                      type='radio'
                      name='reason'
                      value={r.value}
                      checked={form.reason === r.value}
                      onChange={set('reason')}
                      className='sr-only'
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className='grid gap-6 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <label htmlFor='lead-name' className={LABEL}>
                  שם מלא
                </label>
                <Input
                  id='lead-name'
                  autoComplete='name'
                  required
                  minLength={2}
                  maxLength={80}
                  value={form.name}
                  onChange={set('name')}
                />
              </div>
              <div className='space-y-1.5'>
                <label htmlFor='lead-phone' className={LABEL}>
                  טלפון
                </label>
                <Input
                  id='lead-phone'
                  type='tel'
                  dir='ltr'
                  className='text-right'
                  autoComplete='tel'
                  required
                  maxLength={30}
                  value={form.phone}
                  onChange={set('phone')}
                />
              </div>
            </div>

            <div className='space-y-1.5'>
              <label htmlFor='lead-email' className={LABEL}>
                אימייל <span className='text-taupe'>(לא חובה)</span>
              </label>
              <Input
                id='lead-email'
                type='email'
                dir='ltr'
                className='text-right'
                autoComplete='email'
                maxLength={120}
                value={form.email}
                onChange={set('email')}
              />
            </div>

            <div className='space-y-1.5'>
              <label htmlFor='lead-message' className={LABEL}>
                {form.reason === 'valuation' ? 'ספרו לנו על הנכס' : 'הודעה'}{' '}
                <span className='text-taupe'>(לא חובה)</span>
              </label>
              <textarea
                id='lead-message'
                rows={5}
                maxLength={2000}
                value={form.message}
                onChange={set('message')}
                placeholder={
                  form.reason === 'valuation'
                    ? 'כתובת, גודל, מספר חדרים, מכירה או השכרה…'
                    : form.reason === 'viewing'
                      ? 'מתי נוח לכם להגיע?'
                      : ''
                }
                className='w-full border border-line bg-white px-3.5 py-2.5 text-[15px] leading-relaxed placeholder:text-taupe/70 focus-visible:border-ink focus-visible:outline-none'
              />
            </div>

            {/* Hidden from people; bots tend to fill every field. */}
            <div aria-hidden='true' className='absolute -left-[9999px] h-px w-px overflow-hidden'>
              <label htmlFor='lead-website'>אתר</label>
              <input
                id='lead-website'
                tabIndex={-1}
                autoComplete='off'
                value={form.website}
                onChange={set('website')}
              />
            </div>

            {error && (
              <p role='alert' className='border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                {error}
              </p>
            )}

            <Button type='submit' size='lg' className='w-full sm:w-auto' disabled={isSending}>
              {isSending ? 'שולח…' : 'שליחה'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
