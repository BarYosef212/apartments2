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
      <div className='border-b border-gray-100 bg-white'>
        <nav
          role='tablist'
          className='mx-auto flex max-w-6xl gap-6 px-4'
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
                '-mb-px border-b-2 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-muted-foreground hover:text-gray-900',
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
        <div className='mx-auto max-w-6xl space-y-6 px-4 py-8'>
          <header className='text-right'>
            <h1 className='text-2xl font-bold tracking-tight text-gray-900'>
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
