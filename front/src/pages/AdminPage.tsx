import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminYad2Panel } from '../components/AdminYad2Panel';
import { AdminSitePanel } from '../components/AdminSitePanel';
import { AdminLeadsPanel } from '../components/AdminLeadsPanel';
import { AdminFacebookPanel } from '../components/AdminFacebookPanel';

const TABS = [
  { id: 'apartments', label: 'דירות' },
  { id: 'leads', label: 'פניות' },
  { id: 'yad2', label: 'סריקת יד2' },
  { id: 'facebook', label: 'פייסבוק' },
  { id: 'site', label: 'הגדרות אתר' },
] as const;

const PANELS = {
  leads: {
    title: 'פניות',
    subtitle: 'טפסים שנשלחו מהאתר.',
    Panel: AdminLeadsPanel,
  },
  yad2: {
    title: 'סריקת יד2',
    subtitle: 'ייבוא אוטומטי של המודעות מעמוד המתווך ביד2.',
    Panel: AdminYad2Panel,
  },
  facebook: {
    title: 'פרסום בפייסבוק',
    subtitle: 'העתקת מודעות מוכנות לקבוצות פייסבוק ומעקב מה פורסם איפה.',
    Panel: AdminFacebookPanel,
  },
  site: {
    title: 'הגדרות אתר',
    subtitle: 'תמונות, כותרות ופרטי יצירת קשר באתר.',
    Panel: AdminSitePanel,
  },
};

type TabId = (typeof TABS)[number]['id'];

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const activeTab: TabId =
    TABS.find((tab) => tab.id === requested)?.id ?? 'apartments';

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
        <AdminSection {...PANELS[activeTab]} />
      )}
    </div>
  );
}

function AdminSection({
  title,
  subtitle,
  Panel,
}: (typeof PANELS)[keyof typeof PANELS]) {
  return (
    <div className='mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-10'>
      <header className='text-right'>
        <h1 className='font-display text-6xl font-light leading-none'>{title}</h1>
        <p className='mt-2 text-sm text-muted-foreground'>{subtitle}</p>
      </header>
      <Panel />
    </div>
  );
}
