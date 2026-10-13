import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaginationProps } from '../types/component.types';

export function Pagination({
  currentPage,
  totalPages,

  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const arrow =
    'flex h-11 w-11 items-center justify-center border border-line transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav
      aria-label='עמודים'
      className='mt-16 flex items-center justify-center gap-2'
    >
      <button
        type='button'
        aria-label='העמוד הקודם'
        className={arrow}
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronRight className='h-5 w-5' strokeWidth={1.5} />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type='button'
          aria-label={`עמוד ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
          onClick={() => onPageChange(page)}
          className={cn(
            'h-11 min-w-11 px-3 text-[15px] font-semibold tabular-nums transition-colors',
            page === currentPage
              ? 'bg-ink text-white'
              : 'text-taupe hover:text-ink',
          )}
        >
          {page}
        </button>
      ))}
      <button
        type='button'
        aria-label='העמוד הבא'
        className={arrow}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronLeft className='h-5 w-5' strokeWidth={1.5} />
      </button>
    </nav>
  );
}
