import { Card, CardContent, CardHeader, Badge } from './ui';
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
  const CardInner = (
    <Card
      className={`flex h-full flex-col overflow-hidden transition-all duration-200 group-hover:shadow-lg ${
        premium ? 'border-amber-200/50 shadow-lg' : ''
      }`}
    >
      <CardHeader className='p-0 border-none'>
        <div className='relative w-full overflow-hidden bg-muted'>
          <div className='aspect-[4/3] w-full'>
            <img
              src={apartment.img ? sizedImage(apartment.img, 800) : HOUSE_PLACEHOLDER_IMAGE}
              alt={apartment.street}
              className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
            />
          </div>
          {(apartment.images?.length ?? 0) > 1 && (
            <span className='absolute bottom-3 left-3 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-white'>
              {apartment.images!.length} תמונות
            </span>
          )}
          {apartment.dealType && (
            <span className='absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-gray-900'>
              {DEAL_TYPE_LABELS[apartment.dealType]}
            </span>
          )}
          {premium && (
            <div className='absolute right-3 top-3 z-10'>
              <span className='rounded-full bg-amber-400/90 px-2 py-1 text-[10px] font-semibold text-white shadow-md'>
                פרימיום
              </span>
            </div>
          )}
          <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent' />
        </div>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 text-right'>
            <h3 className='truncate text-lg font-semibold leading-tight text-gray-900'>
              {apartment.street}
            </h3>
            <p className='mt-0.5 truncate text-base text-gray-700'>
              {apartment.city}
            </p>
          </div>
          <PriceTag price={apartment.price} dealType={apartment.dealType} />
        </div>
        <p className='text-xs text-muted-foreground text-right'>
          {apartment.type} · {apartment.rooms} חדרים · {apartment.size} מ&quot;ר
          · קומה {apartment.floor}
        </p>
        <p className='line-clamp-2 text-xs text-muted-foreground text-right'>
          {apartment.info}
        </p>

        {apartment.tags?.length > 0 && (
          <div className='mt-1 flex flex-wrap gap-1.5'>
            {apartment.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Link
      to={`/apartments/${apartment._id}`}
      className='group block h-full transform transition-transform duration-200 hover:-translate-y-0.5'
    >
      {premium ? (
        <div className='rounded-2xl bg-gradient-to-br from-amber-300/40 via-amber-200/20 to-transparent p-[2px]'>
          {CardInner}
        </div>
      ) : (
        CardInner
      )}
    </Link>
  );
}
