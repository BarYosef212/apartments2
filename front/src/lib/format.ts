import { api } from '../api/api';
import { DealType } from '../types/apartment.types';

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  sale: 'למכירה',
  rent: 'להשכרה',
};

export function formatPrice(value: number) {
  if (!value || Number.isNaN(value)) return 'לא צוין מחיר';
  return value.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });
}

/**
 * Yad2 images default to 640px; the CDN resizes on request, up to 1600px.
 * Other URLs are returned unchanged.
 */
export function sizedImage(url: string, width: 800 | 1600) {
  if (!/^https:\/\/img\.yad2\.co\.il\//.test(url)) return url;
  return `${url.split('?')[0]}?w=${width}&h=${width}&c=9`;
}

/** Files uploaded in the admin are served by the API server. */
export function mediaUrl(url: string) {
  return url.startsWith('/uploads/') ? `${api.defaults.baseURL}${url}` : url;
}

/** wa.me wants the number in international form without symbols. */
export function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const international = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}
