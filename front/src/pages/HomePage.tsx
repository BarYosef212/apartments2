import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApartmentsApi } from '../hooks/useApartmentsApi';
import { useChat } from '../contexts/ChatContext';
import { DEAL_TYPE_LABELS, formatPrice, mediaUrl, sizedImage } from '../lib/format';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { Apartment, DealType } from '../types/apartment.types';
import { SiteSettings } from '../types/site.types';

// Enough to see every listing; the office has a few dozen at most.
const ALL_LISTINGS_LIMIT = '200';
const FEATURED_COUNT = 3;

const EYEBROW =
  'flex items-center gap-3.5 text-sm font-semibold tracking-[0.08em]';
const FIELD_LABEL = 'text-[13px] font-semibold tracking-[0.06em] text-taupe';
const FIELD_SELECT =
  'h-11 w-full border-0 border-b border-ink bg-transparent p-0 text-lg focus:outline-none focus-visible:border-b-2';

const coverOf = (a: Apartment) => a.images?.[0] || a.img;

/**
 * Picks the photos from the live listings: the most expensive sale listing
 * leads the page, premium listings (then the priciest) are featured, and the
 * newest rental illustrates the owners section.
 */
function pickShowcase(apartments: Apartment[]) {
  const withPhoto = apartments.filter(coverOf);
  const hero = [...withPhoto]
    .filter((a) => a.dealType !== 'rent')
    .sort((a, b) => (b.price || 0) - (a.price || 0))[0];

  const rest = withPhoto.filter((a) => a !== hero);
  const featured = [...rest]
    .sort(
      (a, b) =>
        Number(!!b.premium) - Number(!!a.premium) ||
        (b.price || 0) - (a.price || 0),
    )
    .slice(0, FEATURED_COUNT);

  const owners =
    rest.find((a) => a.dealType === 'rent' && !featured.includes(a)) ??
    rest.find((a) => !featured.includes(a));

  return { hero, featured, owners };
}

export function HomePage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { fetchApartments } = useApartmentsApi();
  const { setIsOpen, setIsAgentMode, setInput } = useChat();
  const { settings } = useSiteSettings();

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dealType, setDealType] = useState<DealType>('sale');
  const [city, setCity] = useState('');
  const [rooms, setRooms] = useState('');

  useEffect(() => {
    fetchApartments({ page: '1', limit: ALL_LISTINGS_LIMIT })
      .then((res) => setApartments(res.results))
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  // Links such as /#owners land here from other pages.
  useEffect(() => {
    if (!hash || !isLoaded) return;
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, isLoaded]);

  const { hero, featured, owners } = pickShowcase(apartments);
  const texts = settings?.texts;
  const phone = settings?.contact.phone;
  const ownersPhoto = settings?.ownersImage
    ? mediaUrl(settings.ownersImage)
    : owners && sizedImage(coverOf(owners), 1600);
  const cities = [...new Set(apartments.map((a) => a.city))].sort();
  const counts = {
    sale: apartments.filter((a) => a.dealType === 'sale').length,
    rent: apartments.filter((a) => a.dealType === 'rent').length,
  };

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ dealType });
    if (city) params.set('city', city);
    if (rooms) params.set('rooms', rooms);
    navigate(`/apartments?${params}`);
  }

  function openOwnerChat() {
    setIsAgentMode(true);
    setInput('שלום, יש לי נכס ואשמח לתאם פגישת הערכה');
    setIsOpen(true);
  }

  return (
    <div>
      {/* Hero */}
      <section className='relative h-[min(820px,100svh)] min-h-[620px] overflow-hidden bg-ink'>
        {settings && <HeroMedia settings={settings} fallback={hero} />}
        <div className='absolute inset-0 bg-[rgba(18,17,15,0.5)]' />
        <div className='absolute inset-x-0 bottom-28 md:bottom-36'>
          <div className='mx-auto max-w-7xl px-5 md:px-10'>
            {texts?.heroEyebrow && (
              <p className={cn(EYEBROW, 'text-[#E7DCC8]')}>
                <span className='block h-px w-10 bg-brass-light' />
                {texts.heroEyebrow}
              </p>
            )}
            <h1 className='mt-5 max-w-4xl whitespace-pre-line font-display text-[clamp(64px,9.5vw,130px)] font-light leading-[0.95] text-white'>
              {texts?.heroTitle}
            </h1>
            {texts?.heroSubtitle && (
              <p className='mt-6 max-w-lg whitespace-pre-line text-lg font-light leading-relaxed text-[#EDE8DF] md:text-xl'>
                {texts.heroSubtitle}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Search */}
      <div className='relative mx-auto -mt-16 max-w-7xl px-5 md:px-10'>
        <form
          onSubmit={handleSearch}
          aria-label='חיפוש נכסים'
          className='flex flex-wrap bg-white shadow-[0_24px_60px_rgba(25,25,23,0.12)]'
        >
          <fieldset className='flex min-w-[240px] flex-1 flex-col gap-2.5 px-7 py-5'>
            <legend className={cn(FIELD_LABEL, 'float-right mb-2.5 w-full')}>
              סוג עסקה
            </legend>
            <div className='flex gap-2'>
              {(['sale', 'rent'] as DealType[]).map((value) => (
                <button
                  key={value}
                  type='button'
                  aria-pressed={dealType === value}
                  onClick={() => setDealType(value)}
                  className={cn(
                    'min-h-11 flex-1 border px-4 text-[17px] font-semibold transition-colors',
                    dealType === value
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-white text-ink hover:border-ink',
                  )}
                >
                  {DEAL_TYPE_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className='flex min-w-[200px] flex-1 flex-col gap-2.5 border-line px-7 py-5 sm:border-s'>
            <label htmlFor='home-city' className={FIELD_LABEL}>
              עיר
            </label>
            <select
              id='home-city'
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={FIELD_SELECT}
            >
              <option value=''>כל הערים</option>
              {cities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex min-w-[160px] flex-1 flex-col gap-2.5 border-line px-7 py-5 sm:border-s'>
            <label htmlFor='home-rooms' className={FIELD_LABEL}>
              חדרים
            </label>
            <select
              id='home-rooms'
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              className={FIELD_SELECT}
            >
              <option value=''>הכל</option>
              {['2', '3', '4', '5'].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type='submit'
            className='inline-flex min-h-[72px] flex-[1_1_100%] items-center justify-center gap-3 bg-ink px-8 text-lg font-semibold text-white transition-colors hover:bg-black sm:min-h-24 sm:flex-[0_1_220px]'
          >
            חיפוש נכסים
            <ArrowLeft className='h-5 w-5' strokeWidth={1.5} />
          </button>
        </form>
      </div>

      {/* Numbers */}
      {counts.sale + counts.rent > 0 && (
        <section
          aria-label='המשרד במספרים'
          className='mx-auto max-w-7xl px-5 pt-24 md:px-10 md:pt-28'
        >
          <dl className='grid grid-cols-3 border-y border-line'>
            {[
              { value: counts.sale, label: 'נכסים למכירה', to: '/apartments?dealType=sale' },
              { value: counts.rent, label: 'נכסים להשכרה', to: '/apartments?dealType=rent' },
              { value: cities.length, label: 'ערים במרכז הארץ' },
            ].map((item) => (
              <div
                key={item.label}
                className='flex flex-col-reverse items-start gap-1 py-7 md:flex-row-reverse md:items-baseline md:justify-end md:gap-5 md:py-10'
              >
                <dt className='text-sm text-taupe md:text-lg'>{item.label}</dt>
                <dd className='font-display text-6xl font-light leading-none tabular-nums md:text-8xl'>
                  {item.to ? (
                    <Link to={item.to} className='hover:opacity-70'>
                      {item.value}
                    </Link>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section
          id='featured'
          className='mx-auto max-w-7xl px-5 pb-28 pt-20 md:px-10 md:pb-32 md:pt-24'
        >
          <div className='flex flex-wrap items-end justify-between gap-6'>
            <div>
              <p className={cn(EYEBROW, 'text-brass')}>
                <span className='block h-px w-8 bg-brass' />
                הנבחרים שלנו
              </p>
              <h2 className='mt-4 font-display text-[clamp(52px,5.4vw,76px)] font-light leading-none'>
                נכסים נבחרים
              </h2>
            </div>
            <Link
              to='/apartments'
              className='inline-flex min-h-11 items-center gap-2.5 border-b border-ink text-[17px] font-semibold hover:opacity-70'
            >
              לכל {apartments.length} הנכסים
              <ArrowLeft className='h-[18px] w-[18px]' strokeWidth={1.5} />
            </Link>
          </div>

          <div className='mt-14 flex flex-wrap gap-10'>
            <FeaturedListing
              apartment={featured[0]}
              large
              className='min-w-0 flex-[999_1_560px]'
            />
            {featured.length > 1 && (
              <div className='flex min-w-0 flex-[1_1_340px] flex-col gap-10'>
                {featured.slice(1).map((apartment) => (
                  <FeaturedListing key={apartment._id} apartment={apartment} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Owners */}
      <section id='owners' className='scroll-mt-20 bg-ink text-white'>
        <div className='flex flex-wrap'>
          {ownersPhoto && (
            <div className='relative min-h-[360px] flex-[1_1_480px] bg-[#2A2925] md:min-h-[560px]'>
              <img
                src={ownersPhoto}
                alt=''
                loading='lazy'
                className='absolute inset-0 h-full w-full object-cover'
              />
            </div>
          )}
          <div className='flex flex-[1_1_480px] flex-col justify-center px-[clamp(24px,6vw,112px)] py-20 md:py-28'>
            <p className={cn(EYEBROW, 'text-brass-light')}>
              <span className='block h-px w-8 bg-brass-light' />
              לבעלי נכסים
            </p>
            <h2 className='mt-5 whitespace-pre-line font-display text-[clamp(52px,5vw,72px)] font-light leading-none'>
              {texts?.ownersTitle}
            </h2>
            {texts?.ownersText && (
              <p className='mt-7 max-w-md whitespace-pre-line text-lg font-light leading-relaxed text-[#CFC8BC]'>
                {texts.ownersText}
              </p>
            )}
            <div className='mt-11 flex flex-wrap items-center gap-7'>
              <button
                type='button'
                onClick={openOwnerChat}
                className='inline-flex min-h-14 items-center bg-sand px-8 text-[17px] font-semibold text-ink transition-colors hover:bg-white'
              >
                לתיאום פגישת הערכה
              </button>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className='inline-flex min-h-11 items-center border-b border-white/50 text-[17px] hover:border-white'
                >
                  או התקשרו: <span dir='ltr' className='mr-1.5'>{phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeaturedListing({
  apartment,
  large = false,
  className,
}: {
  apartment: Apartment;
  large?: boolean;
  className?: string;
}) {
  const specs = [
    apartment.type,
    apartment.rooms && `${apartment.rooms} חדרים`,
    apartment.size && `${apartment.size} מ״ר`,
    large && apartment.floor != null && `קומה ${apartment.floor}`,
  ].filter(Boolean);

  return (
    <Link
      to={`/apartments/${apartment._id}`}
      className={cn('group flex flex-col', className)}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-[#E6E0D6]',
          large ? 'h-[clamp(320px,44vw,640px)]' : 'h-60',
        )}
      >
        <img
          src={sizedImage(coverOf(apartment), large ? 1600 : 800)}
          alt={`${apartment.street}, ${apartment.city}`}
          loading='lazy'
          className='h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]'
        />
        {apartment.dealType && (
          <span className='absolute right-4 top-4 bg-white px-3 py-1.5 text-[13px] font-semibold tracking-[0.06em]'>
            {DEAL_TYPE_LABELS[apartment.dealType]}
          </span>
        )}
      </div>
      <div className='flex items-start justify-between gap-5 pt-5'>
        <div className='min-w-0'>
          <p
            className={cn(
              'truncate font-display font-light leading-none',
              large ? 'text-5xl' : 'text-4xl',
            )}
          >
            {apartment.street}
          </p>
          <p className={cn('mt-2 text-[#4A463F]', large ? 'text-lg' : 'text-base')}>
            {apartment.city}
          </p>
          <p className={cn('mt-3 text-taupe', large ? 'text-[15px]' : 'text-sm')}>
            {specs.join(' · ')}
          </p>
        </div>
        {apartment.price ? (
          <p
            className={cn(
              'whitespace-nowrap font-bold tabular-nums',
              large ? 'text-[26px]' : 'text-xl',
            )}
          >
            {formatPrice(apartment.price)}
            {apartment.dealType === 'rent' && (
              <span className='block text-left text-sm font-normal text-taupe'>
                לחודש
              </span>
            )}
          </p>
        ) : (
          <p className='whitespace-nowrap pt-1.5 text-[15px] text-taupe'>
            {formatPrice(0)}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * The opening image or video chosen in the admin, or else the photo of the
 * priciest listing.
 */
function HeroMedia({
  settings,
  fallback,
}: {
  settings: SiteSettings;
  fallback?: Apartment;
}) {
  const { kind, url } = settings.heroMedia;
  const fallbackSrc = fallback && sizedImage(coverOf(fallback), 1600);
  const cover = 'absolute inset-0 h-full w-full object-cover';

  if (url && kind === 'video') {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return (
      <video
        src={mediaUrl(url)}
        poster={fallbackSrc}
        autoPlay={!reduceMotion}
        muted
        loop
        playsInline
        aria-hidden='true'
        className={cover}
      />
    );
  }
  const src = url ? mediaUrl(url) : fallbackSrc;
  if (!src) return null;
  return <img src={src} alt='' className={cover} />;
}
