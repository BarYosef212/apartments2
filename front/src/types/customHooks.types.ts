import { Apartment, ChatApartment } from './apartment.types';
import {
  ScrapeLog,
  ScraperSettings,
  ScraperSettingsInput,
  ScraperStatus,
} from './scraper.types';

export interface ApartmentsResponse {
  results: Apartment[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
}

export interface UseApartmentsApi {
  fetchCities: () => Promise<string[]>;
  fetchTypes: () => Promise<string[]>;
  fetchApartments: (params: Record<string, string>) => Promise<ApartmentsResponse>;
  fetchApartmentsById: (id: string) => Promise<Apartment>;
  fetchPremiumProperties: () => Promise<Apartment[]>;
}

export interface UseAdminApartmentsApi {
  fetchAdminApartments: (params: Record<string, string>) => Promise<ApartmentsResponse>;
  createApartment: (payload: any) => Promise<void>;
  updateApartment: (id: string, payload: any) => Promise<void>;
  deleteApartment: (id: string) => Promise<void>;
}

export interface UseAuthApi {
  login: (email: string, password: string) => Promise<{ token: string }>;
}

export interface ChatResponse {
  results?: ChatApartment[];
  is_search:boolean,
  reply:string,
  error?: string;
}

export interface UseChatApi {
  sendChatMessage: (message: string, isAgentMode: boolean) => Promise<ChatResponse>;
}

export interface UseScraperApi {
  fetchSettings: () => Promise<ScraperSettings>;
  saveSettings: (payload: ScraperSettingsInput) => Promise<ScraperSettings>;
  fetchStatus: () => Promise<ScraperStatus>;
  fetchLogs: (limit?: number) => Promise<ScrapeLog[]>;
  runScan: () => Promise<void>;
}
