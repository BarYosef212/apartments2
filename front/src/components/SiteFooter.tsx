import { Link } from 'react-router-dom';
import { COMPANY_NAME, CONTACT, SERVICE_AREAS } from '@/config/constants';

const LABEL = 'mb-1 text-[13px] font-semibold tracking-[0.08em] text-taupe';

export function SiteFooter() {
  const hasContact = CONTACT.phone || CONTACT.email || CONTACT.address;

  return (
    <footer className='border-t border-line bg-sand'>
      <div className='mx-auto max-w-7xl px-5 pb-10 pt-20 md:px-10'>
        <div className='flex flex-wrap justify-between gap-14'>
          <div className='min-w-[260px] flex-1'>
            <p className='font-display text-5xl leading-none'>{COMPANY_NAME}</p>
            <p className='mt-4 max-w-sm leading-relaxed text-taupe'>
              תיווך נדל״ן למכירה ולהשכרה. {SERVICE_AREAS.replace(/ · /g, ', ')}.
            </p>
          </div>
          <nav aria-label='ניווט בתחתית' className='flex flex-col gap-3.5'>
            <p className={LABEL}>נכסים</p>
            <Link to='/apartments?dealType=sale' className='hover:opacity-70'>
              נכסים למכירה
            </Link>
            <Link to='/apartments?dealType=rent' className='hover:opacity-70'>
              נכסים להשכרה
            </Link>
            <Link to='/#owners' className='hover:opacity-70'>
              לבעלי נכסים
            </Link>
          </nav>
          {hasContact && (
            <address className='flex flex-col gap-3.5 not-italic'>
              <p className={LABEL}>יצירת קשר</p>
              {CONTACT.phone && (
                <a href={`tel:${CONTACT.phone}`} dir='ltr' className='text-right hover:opacity-70'>
                  {CONTACT.phone}
                </a>
              )}
              {CONTACT.email && (
                <a href={`mailto:${CONTACT.email}`} className='hover:opacity-70'>
                  {CONTACT.email}
                </a>
              )}
              {CONTACT.address && <span>{CONTACT.address}</span>}
            </address>
          )}
        </div>
        <div className='mt-16 flex flex-wrap justify-between gap-4 border-t border-line pt-7 text-sm text-taupe'>
          <span>© {COMPANY_NAME}</span>
          {CONTACT.license && <span>רישיון תיווך {CONTACT.license}</span>}
        </div>
      </div>
    </footer>
  );
}
