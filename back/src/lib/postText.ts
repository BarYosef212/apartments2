// Server-side copy of front/src/lib/facebookPost.ts (the admin's preview and
// group posts), used for automatic Page posts. Keep the two in step.

const FEATURE_EMOJI: Record<string, string> = {
  'מיזוג': '❄️',
  'מזגן טורנדו': '🌀',
  'דוד שמש': '☀️',
  'סורגים': '🔒',
  'ריהוט': '🛋️',
  'ממ״ד': '🛡️',
  'מקלט': '🧱',
  'מרפסת': '🌅',
  'מעלית': '🛗',
  'חניה': '🚗',
  'מחסן': '📦',
  'גישה לנכים': '♿',
  'משופצת': '✨',
  'חיות מחמד': '🐾',
  'מתאים לשותפים': '👥',
  'מטבח כשר': '🍽️',
};

const DEAL_LABELS: Record<string, string> = { sale: 'למכירה', rent: 'להשכרה' };

interface PostApartment {
  _id: unknown;
  dealType?: string;
  type?: string;
  street?: string;
  city?: string;
  rooms?: number;
  size?: number;
  floor?: number;
  price?: number;
  info?: string;
  features?: string[];
}

function formatPrice(value?: number) {
  if (!value) return 'לא צוין מחיר';
  return `${value.toLocaleString('he-IL')} ₪`;
}

/** Fills the post template; a line whose placeholder has no value is dropped. */
export function renderPost(template: string, a: PostApartment, ctx: { phone?: string; siteUrl: string }) {
  const price = a.price ? `${formatPrice(a.price)}${a.dealType === 'rent' ? ' לחודש' : ''}` : formatPrice(0);
  const values: Record<string, string> = {
    עסקה: a.dealType ? DEAL_LABELS[a.dealType] ?? '' : '',
    סוג: a.type ?? '',
    רחוב: a.street ?? '',
    עיר: a.city ?? '',
    חדרים: a.rooms ? String(a.rooms) : '',
    שטח: a.size ? String(a.size) : '',
    קומה: a.floor === 0 ? 'קרקע' : a.floor != null ? String(a.floor) : '',
    מחיר: price,
    תיאור: a.info?.trim() ?? '',
    מאפיינים: (a.features ?? [])
      .map((f) => (FEATURE_EMOJI[f] ? `${FEATURE_EMOJI[f]} ${f}` : f))
      .join('\n'),
    טלפון: ctx.phone ?? '',
    קישור: `${ctx.siteUrl}/apartments/${String(a._id)}`,
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
