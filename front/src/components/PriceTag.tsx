import { cn } from '@/lib/utils';
import { DealType } from '../types/apartment.types';
import { formatPrice } from '../lib/format';

const SIZES = {
  md: { price: 'text-xl', suffix: 'text-xs', empty: 'text-sm' },
  lg: { price: 'text-3xl', suffix: 'text-sm', empty: 'text-base' },
};

export function PriceTag({
  price,
  dealType,
  size = 'md',
  className,
}: {
  price: number;
  dealType?: DealType;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  if (!price) {
    return (
      <p className={cn('whitespace-nowrap font-medium text-muted-foreground', s.empty, className)}>
        {formatPrice(price)}
      </p>
    );
  }
  return (
    <p className={cn('whitespace-nowrap text-left leading-none', className)}>
      <span className={cn('font-bold tracking-tight text-gray-900', s.price)}>
        {formatPrice(price)}
      </span>
      {dealType === 'rent' && (
        <span className={cn('mt-1 block font-normal text-muted-foreground', s.suffix)}>
          לחודש
        </span>
      )}
    </p>
  );
}
