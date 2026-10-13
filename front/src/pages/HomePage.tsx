import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Select } from '../components/ui';
import { ApartmentCard } from '../components/ApartmentCard';
import { CarouselSpacing } from '../components/CarouselSpacing';
import { useApartmentsApi } from '../hooks/useApartmentsApi';
import { useChat } from '../contexts/ChatContext';
import { sizedImage } from '../lib/format';
import { Apartment, DealType } from '../types/apartment.types';
import { COMPANY_NAME } from '@/config/constants';

const LATEST_COUNT = 6;

const DEAL_OPTIONS: { value: DealType; label: string }[] = [
  { value: 'sale', label: 'לקנות' },
  { value: 'rent', label: 'לשכור' },
];

interface Stats {
  sale: number;
  rent: number;
  cities: number;
}

/** Up to three distinct cover photos for the hero collage. */
function heroPhotos(apartments: Apartment[]) {
  const photos: { src: string; apartment: Apartment }[] = [];
  for (const apartment of apartments) {
    const src = apartment.images?.[0] || apartment.img;
    if (src) photos.push({ src, apartment });
    if (photos.length === 3) break;
  }
  return photos;
}

export function HomePage() {
  const navigate = useNavigate();
  const { fetchApartments, fetchCities, fetchPremiumProperties } =
    useApartmentsApi();
  const { setIsOpen, setIsAgentMode, setInput } = useChat();

  const [latest, setLatest] = useState<Apartment[]>([]);
  const [premium, setPremium] = useState<Apartment[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [dealType, setDealType] = useState<DealType>('sale');
  const [city, setCity] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [latestRes, saleRes, rentRes, citiesRes] = await Promise.all([
          fetchApartments({ page: '1', limit: String(LATEST_COUNT) }),
          fetchApartments({ dealType: 'sale', page: '1', limit: '1' }),
          fetchApartments({ dealType: 'rent', page: '1', limit: '1' }),
          fetchCities(),
        ]);
        setLatest(latestRes.results);
        setCities(citiesRes);
        setStats({
          sale: saleRes.totalResults,
          rent: rentRes.totalResults,
          cities: citiesRes.length,
        });
      } catch {
        // The page still works as a search entry point without data.
      } finally {
        setIsLoading(false);
      }
      fetchPremiumProperties()
        .then(setPremium)
        .catch(() => {});
    }
    load();
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ dealType });
    if (city) params.set('city', city);
    navigate(`/apartments?${params}`);
  }

  function openOwnerChat() {
    setIsAgentMode(true);
    setInput('שלום, יש לי נכס ואשמח לשמוע על שיווק שלו');
    setIsOpen(true);
  }

  const photos = heroPhotos(latest);

  return (
    <div className='pb-16'>
      {/* Hero */}
      <section className='mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 md:grid-cols-2 md:gap-14 md:pt-12'>
        <div className='text-right'>
          <p className='text-sm font-medium text-muted-foreground'>
            {COMPANY_NAME} · תיווך נדל״ן
          </p>
          <h1 className='mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 md:text-6xl'>
            מוצאים בית,
            <br />
            בלי לחפש לבד.
          </h1>
          <p className='mt-5 max-w-md text-lg leading-relaxed text-gray-600'>
            דירות למכירה ולהשכרה שאנחנו מכירים מקרוב, וליווי אישי מהשיחה
            הראשונה ועד החתימה.
          </p>

          <form
            onSubmit={handleSearch}
            className='mt-8 rounded-2xl border border-border bg-white p-2 shadow-subtle'
          >
            <div className='flex flex-col gap-2 sm:flex-row'>
              <div
                role='radiogroup'
                aria-label='סוג עסקה'
                className='flex shrink-0 rounded-xl bg-muted p-1'
              >
                {DEAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type='button'
                    role='radio'
                    aria-checked={dealType === opt.value}
                    onClick={() => setDealType(opt.value)}
                    className={cn(
                      'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
                      dealType === opt.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-muted-foreground hover:text-gray-900',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Select
                aria-label='עיר'
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className='h-auto min-h-10 border-0 bg-transparent focus-visible:ring-offset-0'
              >
                <option value=''>כל הערים</option>
                {cities.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              <Button type='submit' className='h-auto min-h-10 shrink-0 px-6'>
                חיפוש
              </Button>
            </div>
          </form>
        </div>

        <HeroCollage photos={photos} isLoading={isLoading} />
      </section>

      {/* Numbers */}
      {stats && stats.sale + stats.rent > 0 && (
        <section className='border-y border-border bg-gray-50/70'>
          <dl className='mx-auto grid max-w-6xl grid-cols-3 divide-x divide-x-reverse divide-border px-4'>
            {[
              { label: 'נכסים למכירה', value: stats.sale, deal: 'sale' },
              { label: 'נכסים להשכרה', value: stats.rent, deal: 'rent' },
              { label: 'ערים', value: stats.cities },
            ].map((item) => (
              <div key={item.label} className='py-6 text-center md:py-8'>
                <dt className='text-xs text-muted-foreground md:text-sm'>
                  {item.label}
                </dt>
                <dd className='mt-1 text-2xl font-bold tabular-nums text-gray-900 md:text-4xl'>
                  {item.deal ? (
                    <Link
                      to={`/apartments?dealType=${item.deal}`}
                      className='hover:underline hover:underline-offset-4'
                    >
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

      {/* Latest listings */}
      {latest.length > 0 && (
        <section className='mx-auto max-w-6xl px-4 pt-16'>
          <SectionHeader
            title='נכנסו לאחרונה'
            subtitle='הנכסים החדשים ביותר אצלנו'
            linkTo='/apartments'
            linkLabel='לכל הנכסים'
          />
          <div className='mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {latest.map((apartment) => (
              <ApartmentCard key={apartment._id} apartment={apartment} />
            ))}
          </div>
        </section>
      )}

      {/* Premium */}
      {premium.length > 0 && (
        <section className='mx-auto max-w-6xl px-4 pt-20'>
          <SectionHeader
            title='בחירה שלנו'
            subtitle='נכסים שאנחנו ממליצים לראות'
          />
          <CarouselSpacing properties={premium} />
        </section>
      )}

      {/* Owners */}
      <section className='mx-auto max-w-6xl px-4 pt-20'>
        <div className='flex flex-col items-start gap-6 rounded-3xl bg-gray-900 px-8 py-10 text-right text-white md:flex-row md:items-center md:justify-between md:px-12 md:py-14'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              יש לכם נכס למכירה או להשכרה?
            </h2>
            <p className='mt-2 max-w-lg text-gray-300'>
              ספרו לנו עליו, ונחזור אליכם עם הערכה ותוכנית שיווק.
            </p>
          </div>
          <Button
            type='button'
            onClick={openOwnerChat}
            size='lg'
            className='shrink-0 bg-white text-gray-900 hover:bg-gray-100'
          >
            דברו איתנו
          </Button>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  linkTo,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className='flex items-end justify-between gap-4'>
      <div className='text-right'>
        <h2 className='text-2xl font-bold tracking-tight text-gray-900 md:text-3xl'>
          {title}
        </h2>
        <p className='mt-1 text-muted-foreground'>{subtitle}</p>
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className='inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-gray-900 hover:underline hover:underline-offset-4'
        >
          {linkLabel}
          <ArrowLeft className='h-4 w-4' />
        </Link>
      )}
    </div>
  );
}

function HeroCollage({
  photos,
  isLoading,
}: {
  photos: { src: string; apartment: Apartment }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className='grid aspect-[5/4] grid-cols-5 grid-rows-2 gap-3'>
        <div className='col-span-3 row-span-2 animate-pulse rounded-3xl bg-muted' />
        <div className='col-span-2 animate-pulse rounded-3xl bg-muted' />
        <div className='col-span-2 animate-pulse rounded-3xl bg-muted' />
      </div>
    );
  }
  if (photos.length === 0) return null;

  const [main, ...rest] = photos;
  return (
    <div
      className={cn(
        'grid aspect-[5/4] gap-3',
        rest.length > 0 && 'grid-cols-5 grid-rows-2',
      )}
    >
      <CollagePhoto
        photo={main}
        className={cn(rest.length > 0 && 'col-span-3 row-span-2')}
        label
      />
      {rest.map((photo) => (
        <CollagePhoto
          key={photo.apartment._id}
          photo={photo}
          className={cn('col-span-2', rest.length === 1 && 'row-span-2')}
        />
      ))}
    </div>
  );
}

function CollagePhoto({
  photo,
  className,
  label = false,
}: {
  photo: { src: string; apartment: Apartment };
  className?: string;
  label?: boolean;
}) {
  const { apartment } = photo;
  return (
    <Link
      to={`/apartments/${apartment._id}`}
      className={cn(
        'group relative overflow-hidden rounded-3xl bg-muted',
        className,
      )}
    >
      <img
        src={sizedImage(photo.src, label ? 1600 : 800)}
        alt={`${apartment.street}, ${apartment.city}`}
        className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]'
      />
      {label && (
        <span className='absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 backdrop-blur'>
          {apartment.street}, {apartment.city}
        </span>
      )}
    </Link>
  );
}
