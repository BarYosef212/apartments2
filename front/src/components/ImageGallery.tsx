import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HOUSE_PLACEHOLDER_IMAGE } from '../config/constants';

export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const photos = images.length > 0 ? images : [HOUSE_PLACEHOLDER_IMAGE];
  const [index, setIndex] = useState(0);
  const hasMany = photos.length > 1;

  useEffect(() => setIndex(0), [images]);

  const go = (delta: number) =>
    setIndex((i) => (i + delta + photos.length) % photos.length);

  // RTL: the right arrow goes back, the left arrow goes forward.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') go(-1);
    if (e.key === 'ArrowLeft') go(1);
  }

  return (
    <div className='space-y-3'>
      <div
        className='group relative overflow-hidden rounded-2xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        tabIndex={hasMany ? 0 : -1}
        onKeyDown={hasMany ? handleKeyDown : undefined}
        aria-roledescription='גלריה'
        aria-label={`${alt}, תמונה ${index + 1} מתוך ${photos.length}`}
      >
        <div className='aspect-[16/10] w-full'>
          <img
            src={photos[index]}
            alt={`${alt}, תמונה ${index + 1}`}
            className='h-full w-full object-cover'
          />
        </div>

        {hasMany && (
          <>
            <button
              type='button'
              onClick={() => go(-1)}
              aria-label='התמונה הקודמת'
              className='absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm transition-opacity hover:bg-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
            >
              <ChevronRight className='h-5 w-5' />
            </button>
            <button
              type='button'
              onClick={() => go(1)}
              aria-label='התמונה הבאה'
              className='absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm transition-opacity hover:bg-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <span className='absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs tabular-nums text-white'>
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {hasMany && (
        <div className='flex gap-2 overflow-x-auto pb-1'>
          {photos.map((src, i) => (
            <button
              key={src}
              type='button'
              onClick={() => setIndex(i)}
              aria-label={`תמונה ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-opacity',
                i === index
                  ? 'ring-2 ring-gray-900 ring-offset-2'
                  : 'opacity-60 hover:opacity-100',
              )}
            >
              <img
                src={src}
                alt=''
                loading='lazy'
                className='h-full w-full object-cover'
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
