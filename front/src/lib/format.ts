export function formatPrice(value: number) {
  if (!value || Number.isNaN(value)) return 'מחיר לפי בקשה';
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
