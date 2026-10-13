import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Apartment } from '../types/apartment.types';
import { Button, Card } from '../components/ui';
import { AdminApartmentFormDialog } from '../components/AdminApartmentFormDialog';
import { AdminApartmentRow } from '../components/AdminApartmentRow';
import { FiltersBar } from '../components/FiltersBar';
import { Pagination } from '../components/Pagination';
import { DEFAULT_PAGE_SIZE } from '../config/constants';
import { ApartmentsResponse } from '../types/customHooks.types';
import { useApartmentsApi } from '../hooks/useApartmentsApi';
import { useAdminApartmentsApi } from '../hooks/useAdminApartmentsApi';

export function AdminDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { fetchCities, fetchTypes } = useApartmentsApi();
  const {
    fetchAdminApartments,
    createApartment,
    updateApartment,
    deleteApartment,
  } = useAdminApartmentsApi();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [type, setType] = useState(searchParams.get('type') ?? '');
  const [rooms, setRooms] = useState(searchParams.get('rooms') ?? '');
  const [dealType, setDealType] = useState(searchParams.get('dealType') ?? '');
  const [premium, setPremium] = useState(searchParams.get('premium') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');

  const [data, setData] = useState<ApartmentsResponse | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

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
    setPremium(searchParams.get('premium') ?? '');
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
      query.limit = String(DEFAULT_PAGE_SIZE);

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchAdminApartments(query);
        setData(result);
      } catch (err) {
        setError('שגיאה בטעינת הדירות. נסה לרענן.');
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
    if (next.premium !== undefined) setPremium(next.premium);
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
    if (premium) nextParams.premium = premium;
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
    nextParams.limit = String(DEFAULT_PAGE_SIZE);

    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function handleCreate() {
    setEditingApartment(null);
    setIsDialogOpen(true);
  }

  function handleEdit(apartment: Apartment) {
    setEditingApartment(apartment);
    setIsDialogOpen(true);
  }

  async function handleSave(formData: any) {
    setIsSaving(true);
    setError(null);

    const images: string[] = formData.images
      .split('\n')
      .map((url: string) => url.trim())
      .filter(Boolean);

    const payload = {
      ...formData,
      images,
      img: images[0] ?? '',
      price: Number(formData.price) || 0,
      dealType: formData.dealType || undefined,
      tags:
        typeof formData.tags === 'string'
          ? formData.tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : formData.tags,
    };

    try {
      if (editingApartment) {
        await updateApartment(editingApartment._id, payload);
      } else {
        await createApartment(payload);
      }
      setIsDialogOpen(false);
      const query: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        query[key] = value;
      });
      if (!query.page) query.page = '1';
      query.limit = String(DEFAULT_PAGE_SIZE);
      const result = await fetchAdminApartments(query);
      setData(result);
    } catch (err) {
      setError('שגיאה בשמירה. וודא שאתה מחובר ושהנתונים תקינים.');
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    try {
      await deleteApartment(deleteCandidate);
      setDeleteCandidate(null);
      const query: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        query[key] = value;
      });
      if (!query.page) query.page = '1';
      query.limit = String(DEFAULT_PAGE_SIZE);
      const result = await fetchAdminApartments(query);
      setData(result);
    } catch (err) {
      setError('שגיאה במחיקה.');
    }
  }

  const apartments = data?.results ?? [];

  return (
    <div>
      <FiltersBar
        admin={true}
        search={search}
        city={city}
        type={type}
        rooms={rooms}
        dealType={dealType}
        minPrice={minPrice}
        maxPrice={maxPrice}
        premium={premium}
        cities={cities}
        types={types}
        onChange={handleFiltersChange}
        onApply={handleApplyClick}
      />

      <div className='mx-auto max-w-7xl px-5 md:px-10 py-8 space-y-6'>
        <header className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div className='text-right'>
            <h1 className='font-display text-6xl font-light leading-none'>
              לוח ניהול נכסים
            </h1>
            <p className='text-sm text-muted-foreground'>
              ניהול מלא של כל הדירות במערכת ({data?.totalResults ?? 0} סה"כ)
            </p>
          </div>
          <Button
            type='button'
            onClick={handleCreate}
            className=' hover: transition-all'
          >
            + הוספת דירה חדשה
          </Button>
        </header>

        {error && (
          <div className=' bg-red-50 p-3 text-sm text-red-600 border border-red-100'>
            {error}
          </div>
        )}

        <Card className='overflow-hidden border-0'>
          <div className='overflow-x-auto'>
            <table className='min-w-full text-right text-xs md:text-sm'>
              <thead className='bg-sand border-b border-line uppercase tracking-wider text-taupe font-medium'>
                <tr>
                  <th className='py-3 pl-4 pr-6'>רחוב</th>
                  <th className='py-3 pl-4'>עיר</th>
                  <th className='py-3 pl-4'>מחיר</th>
                  <th className='py-3 pl-4'>חדרים</th>
                  <th className='py-3 pl-4'>גודל</th>
                  <th className='py-3 pl-4'>סוג</th>
                  <th className='py-3 pl-4'>עסקה</th>
                  <th className='py-3 pl-4 text-center'>פעולות</th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-line'>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className='py-12 text-center text-muted-foreground animate-pulse'
                    >
                      טוען נתונים...
                    </td>
                  </tr>
                ) : apartments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className='py-12 text-center text-muted-foreground'
                    >
                      {data?.totalResults === 0
                        ? 'אין דירות במערכת.'
                        : 'לא נמצאו תוצאות לסינון זה.'}
                    </td>
                  </tr>
                ) : (
                  apartments.map((apartment) => (
                    <AdminApartmentRow
                      key={apartment._id}
                      apartment={apartment}
                      onEdit={handleEdit}
                      onDelete={setDeleteCandidate}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {!isLoading && data && data.totalPages > 1 && (
          <Pagination
            currentPage={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={handlePageChange}
          />
        )}

        <AdminApartmentFormDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSave}
          initialData={editingApartment}
          isSaving={isSaving}
          types={types}
        />

        {deleteCandidate && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm'>
            <div className='w-full max-w-sm bg-white p-6 space-y-4 animate-in fade-in zoom-in duration-200'>
              <h2 className='text-lg font-semibold text-destructive '>
                מחיקת נכס
              </h2>
              <p className='text-sm text-taupe'>
                האם אתה בטוח שברצונך למחוק את הדירה הזו?
                <br />
                פעולה זו היא סופית ולא ניתנת לביטול.
              </p>
              <div className='flex justify-end gap-3 pt-2'>
                <Button
                  type='button'
                  className='bg-white !text-ink border border-line hover:bg-sand'
                  onClick={() => setDeleteCandidate(null)}
                >
                  ביטול
                </Button>
                <Button
                  type='button'
                  onClick={confirmDelete}
                  className='bg-destructive hover:bg-destructive/90 text-white'
                >
                  אישור ומחיקה
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
