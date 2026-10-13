import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Apartment } from '../types/apartment.types';
import { Button, Badge } from '../components/ui';
import { useApartmentsApi } from '../hooks/useApartmentsApi';
import { useChat } from '../contexts/ChatContext';
import { ImageGallery } from '../components/ImageGallery';
import { DEAL_TYPE_LABELS } from '../lib/format';
import { PriceTag } from '../components/PriceTag';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { whatsappUrl } from '../lib/format';


export function ApartmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchApartmentsById } = useApartmentsApi();
  const { setIsOpen, setIsAgentMode, sendMessage, setInput,isAgentMode } = useChat();
  const contact = useSiteSettings().settings?.contact;
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleViewing = async () => {
    setIsAgentMode(true);
    setIsOpen(true);
    const msg = 
      `אני מעוניין לקבוע פגישה בנוגע לנכס ברחוב ${apartment?.street} בעיר ${apartment?.city}`;
    setInput(msg);
    await sendMessage(msg, true);
  };

  

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const res = await fetchApartmentsById(id);
        setApartment(res);
      } catch {
        setError('לא הצלחנו לטעון את הנכס.');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [id]);

  const specs = apartment
    ? [
        { label: 'סוג נכס', value: apartment.type },
        { label: 'חדרים', value: apartment.rooms },
        { label: 'שטח', value: apartment.size && `${apartment.size} מ״ר` },
        { label: 'קומה', value: apartment.floor === 0 ? 'קרקע' : apartment.floor },
      ].filter((spec) => spec.value !== undefined && spec.value !== null && spec.value !== '')
    : [];

  return (
    <div className='mx-auto max-w-7xl px-5 pb-24 pt-8 md:px-10'>
      <button
        type='button'
        onClick={() => navigate(-1)}
        className='mb-6 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-taupe hover:text-ink'
      >
        <ChevronRight className='h-4 w-4' strokeWidth={1.5} />
        חזרה לנכסים
      </button>

      {isLoading && <div className='aspect-[16/10] animate-pulse bg-muted' />}

      {!isLoading && error && <p className='py-16 text-center text-lg text-taupe'>{error}</p>}

      {!isLoading && !error && apartment && (
        <>
          <ImageGallery
            images={
              apartment.images?.length
                ? apartment.images
                : [apartment.img].filter(Boolean)
            }
            alt={`${apartment.street}, ${apartment.city}`}
          />

          <div className='mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20'>
            <div className='min-w-0'>
              {apartment.dealType && (
                <p className='flex items-center gap-3.5 text-sm font-semibold tracking-[0.08em] text-brass'>
                  <span className='block h-px w-8 bg-brass' />
                  {DEAL_TYPE_LABELS[apartment.dealType]}
                </p>
              )}
              <h1 className='mt-4 font-display text-[clamp(60px,7vw,96px)] font-light leading-[0.95]'>
                {apartment.street}
              </h1>
              <p className='mt-3 text-xl text-[#4A463F]'>{apartment.city}</p>

              {specs.length > 0 && (
                <dl className='mt-10 grid grid-cols-2 border-y border-line sm:grid-cols-4'>
                  {specs.map((spec) => (
                    <div key={spec.label} className='py-6'>
                      <dt className='text-sm text-taupe'>{spec.label}</dt>
                      <dd className='mt-1 font-display text-4xl font-light leading-none'>
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {apartment.info && (
                <p className='mt-10 max-w-2xl whitespace-pre-line text-lg font-light leading-relaxed'>
                  {apartment.info}
                </p>
              )}
              {apartment.tags && apartment.tags.length > 0 && (
                <div className='mt-8 flex flex-wrap gap-2'>
                  {apartment.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              )}
            </div>

            <aside className='self-start bg-white p-8 lg:sticky lg:top-28'>
              <p className='text-sm text-taupe'>
                {apartment.dealType === 'rent' ? 'שכירות חודשית' : 'מחיר'}
              </p>
              <PriceTag
                price={apartment.price}
                dealType={apartment.dealType}
                size='lg'
                className='mt-2 text-right'
              />
              <Button onClick={scheduleViewing} size='lg' className='mt-8 w-full'>
                תיאום ביקור בנכס
              </Button>
              {contact?.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className='mt-3 flex min-h-12 w-full items-center justify-center border border-ink text-[15px] font-semibold hover:bg-ink hover:text-white'
                >
                  התקשרו: <span dir='ltr' className='mr-1.5'>{contact.phone}</span>
                </a>
              )}
              {contact?.whatsapp && (
                <a
                  href={`${whatsappUrl(contact.whatsapp)}?text=${encodeURIComponent(
                    `שלום, אשמח לפרטים על הנכס ברחוב ${apartment.street}, ${apartment.city}`,
                  )}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='mt-3 flex min-h-12 w-full items-center justify-center border border-ink text-[15px] font-semibold hover:bg-ink hover:text-white'
                >
                  שליחת הודעה בוואטסאפ
                </a>
              )}
              <p className='mt-6 text-sm leading-relaxed text-taupe'>
                נשמח לתאם ביקור בנכס ולענות על כל שאלה.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
