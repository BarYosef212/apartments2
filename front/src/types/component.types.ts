import { Apartment, DealType } from './apartment.types';
import { ChatApartment } from './apartment.types';

export interface FiltersBarProps {
  admin:boolean
  search: string;
  city: string;
  type: string;
  rooms: string;
  minPrice: string;
  maxPrice: string;
  premium?: string;
  dealType: string;
  cities?: string[];
  types?: string[];
  onChange: (
    next: Partial<
      Record<
        keyof Omit<FiltersBarProps, 'onChange' | 'cities' | 'types'>,
        string
      >
    >,
  ) => void;
  onApply: () => void;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;

  onPageChange: (page: number) => void;
}

export interface SearchInputProps {
  value: string;
  
  onChange: (value: string) => void;
}

export interface ApartmentFormState {
  /** One image URL per line; the first is the cover image. */
  images: string;
  price: number;
  street: string;
  city: string;
  type: string;
  info: string;
  rooms: number;
  floor: number;
  size: string;
  tags: string;
  premium?:boolean
  dealType: DealType | '';
}

export interface AdminApartmentFormDialogProps {
  isOpen: boolean;
  initialData?: Apartment | null;
  isSaving: boolean;
  types?: string[];

  onClose: () => void;
  onSave: (data: ApartmentFormState) => Promise<void>;
}

export interface AdminApartmentRowProps {
  apartment: Apartment;

  onEdit: (apartment: Apartment) => void;
  onDelete: (id: string) => void;
}

export interface ProtectedRouteProps {
  children: React.ReactElement;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  results?: ChatApartment[];
  isSearch?: boolean
}
