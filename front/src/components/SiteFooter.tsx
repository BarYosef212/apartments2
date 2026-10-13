import { Link } from 'react-router-dom';
import { COMPANY_NAME } from '@/config/constants';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import { whatsappUrl } from '../lib/format';

const LABEL = 'mb-1 text-[13px] font-semibold tracking-[0.08em] text-taupe';

export function SiteFooter() {
  const { settings } = useSiteSettings();
  const contact = settings?.contact;
  const areas = settings?.texts.heroEyebrow.replace(/ · /g, ', ');
  const hasContact =
    contact && (contact.phone || contact.whatsapp || contact.email || contact.address);

  return (
    <footer className='border-t border-line bg-sand'>
      <div className='mx-auto max-w-7xl px-5 pb-10 pt-20 md:px-10'>
        <div className='flex flex-wrap justify-between gap-14'>
          <div className='min-w-[260px] flex-1'>
            <p className='font-display text-5xl leading-none'>{COMPANY_NAME}</p>
            <p className='mt-4 max-w-sm leading-relaxed text-taupe'>
              תיווך נדל״ן למכירה ולהשכרה{areas ? `. ${areas}.` : '.'}
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
              {contact.phone && (
                <a href={`tel:${contact.phone}`} dir='ltr' className='text-right hover:opacity-70'>
                  {contact.phone}
                </a>
              )}
              {contact.whatsapp && (
                <a
                  href={whatsappUrl(contact.whatsapp)}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='hover:opacity-70'
                >
                  וואטסאפ
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className='break-all hover:opacity-70'>
                  {contact.email}
                </a>
              )}
              {contact.address && <span>{contact.address}</span>}
            </address>
          )}
        </div>
        <div className='mt-16 flex flex-wrap justify-between gap-4 border-t border-line pt-7 text-sm text-taupe'>
          <span>© {COMPANY_NAME}</span>
          {contact?.license && <span>רישיון תיווך {contact.license}</span>}
        </div>
      </div>
    </footer>
  );
}
