import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApartmentCard } from '../components/ApartmentCard';
import { FiltersBar } from '../components/FiltersBar';
import { Pagination } from '../components/Pagination';
import {
  DEFAULT_CARD_SKELETON_COUNT,
  DEFAULT_PAGE_SIZE,
} from '../config/constants';
import { ApartmentsResponse } from '../types/customHooks.types';
import { useApartmentsApi } from '../hooks/useApartmentsApi';

export function ApartmentsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchApartments, fetchCities, fetchTypes } = useApartmentsApi();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [type, setType] = useState(searchParams.get('type') ?? '');
  const [rooms, setRooms] = useState(searchParams.get('rooms') ?? '');
  const [dealType, setDealType] = useState(searchParams.get('dealType') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');

  const [data, setData] = useState<ApartmentsResponse | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const[pressed,setPressed]=useState(false);

  const currentPage = Number(searchParams.get('page') ?? '1');

  useEffect(() => {
    async function fetchCitiesAndTypes() {
      try {
        const [citiesRes, typesRes] = await Promise.all([
          fetchCities(),
          fetchTypes(),
        ]);
        setCities(citiesRes);
        setTypes(typesRes);
      } catch (err) {
        console.error('Failed to load cities/types', err);
      }
    }
    fetchCitiesAndTypes();
  }, []);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
    setCity(searchParams.get('city') ?? '');
    setType(searchParams.get('type') ?? '');
    setRooms(searchParams.get('rooms') ?? '');
    setDealType(searchParams.get('dealType') ?? '');
    setMinPrice(searchParams.get('minPrice') ?? '');
    setMaxPrice(searchParams.get('maxPrice') ?? '');
  }, [searchParams]);

  useEffect(() => {
    async function loadApartments() {
      const query: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        query[key] = value;
      });

      if (!query.page) query.page = '1';
      if (!query.limit) query.limit = String(DEFAULT_PAGE_SIZE);

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchApartments(query);
        setData(result);
      } catch (err) {
        setError('Failed to load apartments');
      } finally {
        setIsLoading(false);
      }
    }

    loadApartments();
  }, [searchParams]);

 
  const handleFiltersChange = (next: any) => {
    if (next.search !== undefined) setSearch(next.search);
    if (next.city !== undefined) setCity(next.city);
    if (next.type !== undefined) setType(next.type);
    if (next.rooms !== undefined) setRooms(next.rooms);
    if (next.dealType !== undefined) setDealType(next.dealType);
    if (next.minPrice !== undefined) setMinPrice(next.minPrice);
    if (next.maxPrice !== undefined) setMaxPrice(next.maxPrice);
  };

  const handleApplyClick = () => {
    const nextParams: Record<string, string> = {};
    if (search) nextParams.search = search;
    if (city) nextParams.city = city;
    if (type) nextParams.type = type;
    if (rooms) nextParams.rooms = rooms;
    if (dealType) nextParams.dealType = dealType;
    if (minPrice) nextParams.minPrice = minPrice;
    if (maxPrice) nextParams.maxPrice = maxPrice;
    nextParams.page = '1';
    nextParams.limit = String(DEFAULT_PAGE_SIZE);

    setSearchParams(nextParams);
  };

  const handlePageChange = (nextPage: number) => {
    const nextParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      nextParams[key] = value;
    });
    nextParams.page = String(nextPage);
    nextParams.limit = String(DEFAULT_CARD_SKELETON_COUNT);

    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const apartments = data?.results ?? [];

  return (
    <div>
      <FiltersBar
        admin={false}
        search={search}
        city={city}
        type={type}
        rooms={rooms}
        dealType={dealType}
        minPrice={minPrice}
        maxPrice={maxPrice}
        cities={cities}
        types={types}
        onChange={handleFiltersChange}
        onApply={handleApplyClick}
      />

      <div className='mx-auto max-w-6xl px-4 pb-10 pt-6'>
        <header className='mb-8 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between'>
          <h1 className='text-3xl font-semibold tracking-tight text-gray-900 text-right'>
            דירות
          </h1>
        </header>
        {isLoading && (
          <div className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: DEFAULT_CARD_SKELETON_COUNT }).map(
              (_, index) => (
                <div key={index} className='h-full'>
                  <div className='animate-pulse rounded-2xl bg-muted h-72' />
                </div>
              ),
            )}
          </div>
        )}

        {!isLoading && error && <p className='text-sm text-red-500'>{error}</p>}

        {!isLoading && !error && (
          <>
            {apartments.length === 0 ? (
              <p className='text-sm text-muted-foreground text-right'>
                לא נמצאו דירות מתאימות. נסה לשנות את הסינון.
              </p>
            ) : (
              <div className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
                {apartments.map((apartment) => (
                  <ApartmentCard key={apartment._id} apartment={apartment} />
                ))}
              </div>
            )}

            <Pagination
              currentPage={data?.currentPage ?? currentPage}
              totalPages={data?.totalPages ?? 1}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
