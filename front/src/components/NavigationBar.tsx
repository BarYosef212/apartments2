import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isAuthenticated } from '../lib/auth';
import { COMPANY_NAME } from '@/config/constants';

const LINKS = [
  { to: '/apartments?dealType=sale', label: 'נכסים למכירה' },
  { to: '/apartments?dealType=rent', label: 'נכסים להשכרה' },
  { to: '/#owners', label: 'לבעלי נכסים' },
  { to: '/contact', label: 'צרו קשר' },
];

/** Over the home page hero the bar is transparent until the page scrolls. */
function useOverHero() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return pathname === '/' && !scrolled;
}

export function NavigationBar() {
  const { pathname, search } = useLocation();
  const overHero = useOverHero();
  const current = pathname + search;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-30 transition-colors duration-300',
        overHero
          ? 'bg-transparent text-white'
          : 'border-b border-line bg-sand/95 text-ink backdrop-blur',
      )}
    >
      <div className='mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 md:px-10'>
        <Link
          to='/'
          className='font-display text-4xl leading-none tracking-wide'
        >
          {COMPANY_NAME}
        </Link>
        <nav
          aria-label='ניווט ראשי'
          className='flex items-center gap-5 overflow-x-auto text-[15px] font-medium md:gap-9'
        >
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'hidden whitespace-nowrap py-2 transition-opacity hover:opacity-70 sm:block',
                current === link.to &&
                  'underline decoration-1 underline-offset-8',
              )}
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated() && (
            <Link
              to='/admin'
              className={cn(
                'whitespace-nowrap py-2 transition-opacity hover:opacity-70',
                pathname === '/admin' &&
                  'underline decoration-1 underline-offset-8',
              )}
            >
              ניהול
            </Link>
          )}
          <Link
            to='/apartments'
            className={cn(
              'inline-flex min-h-11 items-center whitespace-nowrap border px-5 transition-colors',
              overHero
                ? 'border-white/70 hover:bg-white hover:text-ink'
                : 'border-ink hover:bg-ink hover:text-white',
            )}
          >
            כל הנכסים
          </Link>
        </nav>
      </div>
    </header>
  );
}
