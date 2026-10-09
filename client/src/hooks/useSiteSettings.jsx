import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const DEFAULT_SITE_NAME = 'TrackHive';
const SiteSettingsContext = createContext(null);

function cleanSiteName(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_SITE_NAME;
}

export function SiteSettingsProvider({ children }) {
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);

  const refreshSiteSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/settings/public');
      setSiteName(cleanSiteName(data?.siteName));
    } catch {
      setSiteName(DEFAULT_SITE_NAME);
    }
  }, []);

  useEffect(() => {
    refreshSiteSettings();
  }, [refreshSiteSettings]);

  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  return (
    <SiteSettingsContext.Provider value={{ siteName, refreshSiteSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (!context) throw new Error('useSiteSettings must be used within SiteSettingsProvider');
  return context;
}
