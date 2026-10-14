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

/** Admin only. The password is write-only: the server says whether one is set. */
export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  from: string;
  hasPassword: boolean;
}

export interface SiteSettings {
  smtp?: SmtpSettings;
  /** An empty url means the home page picks a photo from the listings. */
  heroMedia: { kind: MediaKind; url: string; /** Videos played after url, in order. */ more?: string[] };
  ownersImage: string;
  texts: SiteTexts;
  contact: SiteContact;
}
