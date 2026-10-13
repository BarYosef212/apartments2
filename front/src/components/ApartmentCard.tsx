import { Link } from 'react-router-dom';
import { Apartment } from '../types/apartment.types';
import { HOUSE_PLACEHOLDER_IMAGE } from '../config/constants';
import { DEAL_TYPE_LABELS, sizedImage } from '../lib/format';
import { PriceTag } from './PriceTag';

export function ApartmentCard({
  apartment,
  premium = false,
}: {
  apartment: Apartment;
  premium?: Boolean;
}) {
  const imageCount = apartment.images?.length ?? 0;
  const specs = [
    apartment.type,
    apartment.rooms && `${apartment.rooms} חדרים`,
    apartment.size && `${apartment.size} מ״ר`,
    apartment.floor != null && `קומה ${apartment.floor}`,
  ].filter(Boolean);

  return (
    <Link
      to={`/apartments/${apartment._id}`}
      className='group flex h-full flex-col'
    >
      <div className='relative aspect-[4/3] overflow-hidden bg-[#E6E0D6]'>
        <img
          src={apartment.img ? sizedImage(apartment.img, 800) : HOUSE_PLACEHOLDER_IMAGE}
          alt={`${apartment.street}, ${apartment.city}`}
          loading='lazy'
          className='h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]'
        />
        <div className='absolute inset-x-3 top-3 flex justify-between gap-2'>
          {apartment.dealType && (
            <span className='bg-white px-2.5 py-1 text-xs font-semibold tracking-[0.06em]'>
              {DEAL_TYPE_LABELS[apartment.dealType]}
            </span>
          )}
          {(premium || apartment.premium) && (
            <span className='bg-ink px-2.5 py-1 text-xs font-semibold tracking-[0.06em] text-brass-light'>
              בחירה שלנו
            </span>
          )}
        </div>
        {imageCount > 1 && (
          <span className='absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-white'>
            {imageCount} תמונות
          </span>
        )}
      </div>

      <div className='flex flex-1 flex-col pt-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='truncate font-display text-4xl font-light leading-none'>
              {apartment.street}
            </h3>
            <p className='mt-1.5 truncate text-base text-[#4A463F]'>
              {apartment.city}
            </p>
          </div>
          <PriceTag price={apartment.price} dealType={apartment.dealType} />
        </div>
        <p className='mt-2.5 text-sm text-taupe'>{specs.join(' · ')}</p>
        {apartment.tags?.length > 0 && (
          <p className='mt-2 text-xs text-taupe'>{apartment.tags.join(' · ')}</p>
        )}
      </div>
    </Link>
  );
}
