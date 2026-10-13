import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Apartment } from '../types/apartment.types';
import { Button, Badge } from '../components/ui';
import { useApartmentsApi } from '../hooks/useApartmentsApi';
import { useChat } from '../contexts/ChatContext';
import { ImageGallery } from '../components/ImageGallery';

function formatPrice(value: number) {
  if (Number.isNaN(value)) return value;
  return value.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });
}

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
              <p className='text-3xl font-semibold tracking-tight text-gray-900'>
                {formatPrice(apartment.price)}
              </p>
              <p className='text-base font-medium text-gray-900'>
                {apartment.street}, {apartment.city}
              </p>
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
            <div className='pt-4 justify-self-end'>
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
