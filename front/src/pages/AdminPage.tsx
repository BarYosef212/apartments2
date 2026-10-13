import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminYad2Panel } from '../components/AdminYad2Panel';

const TABS = [
  { id: 'apartments', label: 'דירות' },
  { id: 'yad2', label: 'סריקת יד2' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabId =
    searchParams.get('tab') === 'yad2' ? 'yad2' : 'apartments';

  // The apartments tab owns the remaining query params (filters, page),
  // so switching tabs starts from a clean URL.
  function selectTab(tab: TabId) {
    setSearchParams(tab === 'apartments' ? {} : { tab });
  }

  return (
    <div>
      <div className='border-b border-line bg-sand'>
        <nav
          role='tablist'
          className='mx-auto flex max-w-7xl gap-8 px-5 md:px-10'
          aria-label='ניהול'
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type='button'
              role='tab'
              aria-selected={activeTab === tab.id}
              onClick={() => selectTab(tab.id)}
              className={cn(
                '-mb-px min-h-12 border-b-2 py-3 text-[15px] font-semibold transition-colors',
                activeTab === tab.id
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted-foreground hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'apartments' ? (
        <AdminDashboardPage />
      ) : (
        <div className='mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-10'>
          <header className='text-right'>
            <h1 className='font-display text-6xl font-light leading-none'>
              סריקת יד2
            </h1>
            <p className='text-sm text-muted-foreground'>
              ייבוא אוטומטי של המודעות מעמוד המתווך ביד2.
            </p>
          </header>
          <AdminYad2Panel />
        </div>
      )}
    </div>
  );
}
