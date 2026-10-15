import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/api';
import { SiteSettings } from '../types/site.types';

interface SiteSettingsContextValue {
  /** null until loaded. */
  settings: SiteSettings | null;
  setSettings: (settings: SiteSettings) => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: null,
  setSettings: () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    api
      .get<SiteSettings>('/site-settings')
      .then((res) => setSettings(res.data))
      .catch((err) => console.error('Failed to load site settings', err));
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
