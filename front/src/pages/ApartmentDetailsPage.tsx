import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Apartment } from '../types/apartment.types';
import { Button, Badge } from '../components/ui';
import { useApartmentsApi } from '../hooks/useApartmentsApi';
import { useChat } from '../contexts/ChatContext';
import { ImageGallery } from '../components/ImageGallery';
import { DEAL_TYPE_LABELS } from '../lib/format';
import { PriceTag } from '../components/PriceTag';


export function ApartmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchApartmentsById } = useApartmentsApi();
  const { setIsOpen, setIsAgentMode, sendMessage, setInput,isAgentMode } = useChat();
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
        setError('Failed to load apartment');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [id]);

  return (
    <div className='mx-auto max-w-5xl px-4 py-8 space-y-6'>
      <Button type='button' onClick={() => navigate(-1)}>
        חזרה לרשימה
      </Button>

      {isLoading && <div className='h-80 animate-pulse rounded-2xl bg-muted' />}

      {!isLoading && error && <p className='text-sm text-red-500'>{error}</p>}

      {!isLoading && !error && apartment && (
        <div className='space-y-6'>
          <ImageGallery
            images={
              apartment.images?.length
                ? apartment.images
                : [apartment.img].filter(Boolean)
            }
            alt={`${apartment.street}, ${apartment.city}`}
          />

          <div className='grid gap-6 md:grid-cols-[2fr,1fr]'>
            <div className='space-y-3 text-right'>
              {apartment.dealType && (
                <Badge>{DEAL_TYPE_LABELS[apartment.dealType]}</Badge>
              )}
              <div>
                <h1 className='text-3xl font-semibold leading-tight tracking-tight text-gray-900'>
                  {apartment.street}
                </h1>
                <p className='mt-1 text-xl text-gray-700'>{apartment.city}</p>
              </div>
              <p className='text-sm text-muted-foreground'>
                {apartment.type} · {apartment.rooms} חדרים · {apartment.size}{' '}
                מ&quot;ר · קומה {apartment.floor}
              </p>
              <p className='text-sm text-gray-700'>{apartment.info}</p>
              {apartment.tags && apartment.tags.length > 0 && (
                <div className='flex flex-wrap gap-1.5 pt-2'>
                  {apartment.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className='flex flex-col items-end gap-5 justify-self-end'>
              <PriceTag
                price={apartment.price}
                dealType={apartment.dealType}
                size='lg'
              />
              <Button onClick={scheduleViewing} size='lg'>
                קבע פגישה עבור נכס זה
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
