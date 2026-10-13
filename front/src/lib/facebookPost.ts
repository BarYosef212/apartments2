import { Apartment } from '../types/apartment.types';
import { DEAL_TYPE_LABELS, formatPrice } from './format';

/** Placeholders the post template understands, with what each one fills in. */
export const POST_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'עסקה', label: 'למכירה / להשכרה' },
  { key: 'סוג', label: 'סוג הנכס' },
  { key: 'רחוב', label: 'רחוב' },
  { key: 'עיר', label: 'עיר' },
  { key: 'חדרים', label: 'מספר חדרים' },
  { key: 'שטח', label: 'שטח במ״ר' },
  { key: 'קומה', label: 'קומה' },
  { key: 'מחיר', label: 'מחיר' },
  { key: 'תיאור', label: 'תיאור הנכס' },
  { key: 'מאפיינים', label: 'מה יש בנכס' },
  { key: 'טלפון', label: 'טלפון המשרד' },
  { key: 'קישור', label: 'קישור לנכס באתר' },
];

/**
 * Fills the template for one listing. A line whose placeholder has no value
 * (no floor, no description…) is dropped rather than left half-empty.
 */
export function renderPost(
  template: string,
  apartment: Apartment,
  context: { phone?: string; siteOrigin: string },
) {
  const price = apartment.price
    ? `${formatPrice(apartment.price)}${apartment.dealType === 'rent' ? ' לחודש' : ''}`
    : formatPrice(0);

  const values: Record<string, string> = {
    עסקה: apartment.dealType ? DEAL_TYPE_LABELS[apartment.dealType] : '',
    סוג: apartment.type ?? '',
    רחוב: apartment.street ?? '',
    עיר: apartment.city ?? '',
    חדרים: apartment.rooms ? String(apartment.rooms) : '',
    שטח: apartment.size ? String(apartment.size) : '',
    קומה: apartment.floor === 0 ? 'קרקע' : apartment.floor != null ? String(apartment.floor) : '',
    מחיר: price,
    תיאור: apartment.info?.trim() ?? '',
    מאפיינים: apartment.features?.join(' · ') ?? '',
    טלפון: context.phone ?? '',
    קישור: `${context.siteOrigin}/apartments/${apartment._id}`,
  };

  return template
    .split('\n')
    .flatMap((line) => {
      let missing = false;
      const filled = line.replace(/\{([^{}]+)\}/g, (match, key: string) => {
        if (!(key in values)) return match;
        if (!values[key]) missing = true;
        return values[key];
      });
      return missing ? [] : [filled];
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
