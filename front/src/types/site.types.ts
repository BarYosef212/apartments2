export type MediaKind = 'image' | 'video';

export interface SiteTexts {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  ownersTitle: string;
  ownersText: string;
}

export interface SiteContact {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  license: string;
  /** Admin only: where website forms are emailed. */
  leadsEmail?: string;
}

export interface SiteSettings {
  /** An empty url means the home page picks a photo from the listings. */
  heroMedia: { kind: MediaKind; url: string };
  ownersImage: string;
  texts: SiteTexts;
  contact: SiteContact;
}
