export type DealType = 'sale' | 'rent';

export interface Apartment {
  _id: string;
  img: string;
  images?: string[];
  price: number;
  street: string;
  city: string;
  type: string;
  info: string;
  rooms: number;
  floor: number;
  size: string;
  tags: string[];
  premium?: boolean;
  dealType?: DealType;
}

export interface ChatApartment {
  _id: string;
  street: string;
  city: string;
  price: number;
  rooms: number;
  type: string;
  floor: number;
  size: string;
  tags: string[];
  img?: string;
  info?: string;
  premimum?: boolean;
}
