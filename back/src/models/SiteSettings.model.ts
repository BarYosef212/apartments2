import mongoose, { Schema } from 'mongoose';
import { SiteSettingsDocument } from '../types/models.types';

const SiteSettingsSchema = new Schema<SiteSettingsDocument>(
  {
    // Empty url = the home page picks a photo from the listings.
    heroMedia: {
      type: new Schema(
        {
          kind: { type: String, enum: ['image', 'video'], default: 'image' },
          url: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    ownersImage: { type: String, default: '' },
    // Home page copy; a line break in a title is kept as-is.
    texts: {
      type: new Schema(
        {
          heroEyebrow: { type: String, default: 'ראשון לציון · בת ים · תל אביב והסביבה' },
          heroTitle: { type: String, default: 'הבית הבא שלכם,\nבידיים הנכונות.' },
          heroSubtitle: {
            type: String,
            default: 'משרד תיווך בוטיק. מעט נכסים, הרבה תשומת לב, וליווי אישי מהביקור הראשון ועד מסירת המפתח.',
          },
          ownersTitle: { type: String, default: 'מוכרים או משכירים?\nנמצא את הקונה הנכון.' },
          ownersText: {
            type: String,
            default: 'אנחנו מצלמים, מתמחרים ומשווקים כל נכס באופן אישי, ומלווים אתכם עד החתימה. פגישת הערכה ראשונה ללא התחייבות.',
          },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    // Text of Facebook group posts; {placeholders} are filled per listing.
    facebookTemplate: {
      type: String,
      default:
        '{עסקה}: {סוג} ב{עיר}\n{רחוב}, {עיר}\n{חדרים} חדרים · {שטח} מ״ר · קומה {קומה}\n{מחיר}\n\n{תיאור}\n\n{מאפיינים}\n\nלפרטים: {טלפון}\n{קישור}',
    },
    // Outgoing mail for website forms. The password is stored encrypted.
    smtp: {
      type: new Schema(
        {
          host: { type: String, default: '', trim: true },
          port: { type: Number, default: 465 },
          user: { type: String, default: '', trim: true },
          passEncrypted: { type: String, default: '' },
          from: { type: String, default: '', trim: true },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    contact: {
      type: new Schema(
        {
          phone: { type: String, default: '', trim: true },
          whatsapp: { type: String, default: '', trim: true },
          email: { type: String, default: '', trim: true },
          address: { type: String, default: '', trim: true },
          license: { type: String, default: '', trim: true },
          // Private: where website forms are sent. Never sent to the public site.
          leadsEmail: { type: String, default: '', trim: true },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
  },
  { timestamps: true }
);

export const SiteSettings = mongoose.model<SiteSettingsDocument>('site_settings', SiteSettingsSchema);

/** The collection holds a single document; create it on first access. */
export async function getSiteSettingsDoc() {
  const existing = await SiteSettings.findOne();
  if (existing) return existing;
  return SiteSettings.create({});
}
