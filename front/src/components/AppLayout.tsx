import React from 'react';
import { useLocation } from 'react-router-dom';
import { NavigationBar } from './NavigationBar';
import { ChatWidget } from './ChatWidget';
import { SiteFooter } from './SiteFooter';

export function AppLayout({ children }: { children: React.ReactNode }) {
  // The home page hero runs under the transparent navigation bar.
  const isHome = useLocation().pathname === '/';

  return (
    <div className='flex min-h-screen flex-col bg-background text-foreground' dir='rtl'>
      <NavigationBar />
      <main className={isHome ? 'flex-1' : 'flex-1 pt-20'}>{children}</main>
      <SiteFooter />
      <ChatWidget />
    </div>
  );
}
