export interface ApartmentFilters {
  search?: string;
  city?: string;
  type?: string;
  rooms?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  premium?: boolean;
  dealType?: 'sale' | 'rent';
}

export interface EmbeddingDocument {
  _id: string;
  embedding: number[];
  [key: string]: any;
}
