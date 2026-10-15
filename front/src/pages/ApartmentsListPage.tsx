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

const GRID = 'grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3';

const PAGE_TITLES: Record<string, string> = {
  '': 'כל הנכסים',
  sale: 'נכסים למכירה',
  rent: 'נכסים להשכרה',
};

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

      <div className='mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-10'>
        <header className='mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6'>
          <h1 className='font-display text-[clamp(56px,6vw,84px)] font-light leading-none'>
            {PAGE_TITLES[searchParams.get('dealType') ?? ''] ?? PAGE_TITLES['']}
          </h1>
          {data && !isLoading && (
            <p className='text-taupe'>
              {data.totalResults === 1 ? 'נכס אחד' : `${data.totalResults} נכסים`}
            </p>
          )}
        </header>
        {isLoading && (
          <div className={GRID}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className='bg-white'>
                <div className='aspect-[4/3] animate-pulse bg-muted' />
                <div className='space-y-3 p-5'>
                  <div className='h-8 w-1/2 animate-pulse bg-muted' />
                  <div className='h-4 w-1/3 animate-pulse bg-muted' />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && <p className='text-sm text-red-500'>{error}</p>}

        {!isLoading && !error && (
          <>
            {apartments.length === 0 ? (
              <p className='py-16 text-center text-lg text-taupe'>
                לא נמצאו נכסים מתאימים. נסו לשנות את הסינון.
              </p>
            ) : (
              <div className={GRID}>
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
