import { api } from '../api/api';
import { MediaKind, SiteSettings } from '../types/site.types';

export type SiteSettingsUpdate = Partial<
  Pick<SiteSettings, 'heroMedia' | 'ownersImage' | 'texts' | 'contact'>
>;

export function useSiteAdminApi() {
  const fetchSettings = async () =>
    (await api.get<SiteSettings>('/admin/site/settings')).data;

  const saveSettings = async (payload: SiteSettingsUpdate) =>
    (await api.put<SiteSettings>('/admin/site/settings', payload)).data;

  const uploadMedia = async (file: File, onProgress?: (percent: number) => void) => {
    const body = new FormData();
    body.append('file', file);
    const res = await api.post<{ url: string; kind: MediaKind }>(
      '/admin/site/uploads',
      body,
      {
        onUploadProgress: (e) =>
          e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      },
    );
    return res.data;
  };

  return { fetchSettings, saveSettings, uploadMedia };
}
