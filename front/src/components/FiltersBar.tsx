import { Button, Input, Select } from './ui';
import { SearchInput } from './SearchInput';
import { FiltersBarProps } from '../types/component.types';

export function FiltersBar({
  admin = false,
  search,
  city,
  type,
  rooms,
  minPrice,
  maxPrice,
  premium,
  dealType,
  cities = [],
  types = [],
  
  onChange,
  onApply,
}: FiltersBarProps) {
  const handleReset = () => {
    onChange({
      search: '',
      city: '',
      type: '',
      rooms: '',
      minPrice: '',
      maxPrice: '',
      premium: '',
      dealType: '',
    });
  };    

  return (
    <div className='sticky top-16 z-20 mb-6 border-b border-border bg-background/90 backdrop-blur'>
      <div className='mx-auto flex max-w-6xl flex-col gap-3 py-4'>
        <div>
          <SearchInput
            value={search}
            onChange={(value: any) => onChange({ search: value })}
          />
        </div>
        <div
          className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}
        >
          <div
            className={`grid flex-1 gap-2 ${
              admin ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'
            }`}
          >
            <Select
              value={dealType}
              onChange={(e) => onChange({ dealType: e.target.value })}
            >
              <option value=''>מכירה והשכרה</option>
              <option value='sale'>למכירה</option>
              <option value='rent'>להשכרה</option>
            </Select>
            <Select
              value={city}
              onChange={(e) => onChange({ city: e.target.value })}
            >
              <option value=''>כל הערים</option>
              {cities.length > 0 ? (
                cities.map((cityName) => (
                  <option key={cityName} value={cityName}>
                    {cityName}
                  </option>
                ))
              ) : (
                <>
                  <option value='Tel Aviv'>תל אביב</option>
                  <option value='Jerusalem'>ירושלים</option>
                  <option value='Haifa'>חיפה</option>
                </>
              )}
            </Select>
            <Select
              value={type}
              onChange={(e) => onChange({ type: e.target.value })}
            >
              <option value=''>כל סוגי הנכסים</option>
              {types.length > 0
                ? types.map((typeName) => (
                    <option key={typeName} value={typeName}>
                      {typeName}
                    </option>
                  ))
                : null}
            </Select>
            <Select
              value={rooms}
              onChange={(e) => onChange({ rooms: e.target.value })}
            >
              <option value=''>כל מספרי החדרים</option>
              <option value='2'>2 חדרים</option>
              <option value='3'>3 חדרים</option>
              <option value='4'>4 חדרים</option>
              <option value='5'>5+ חדרים</option>
            </Select>
            {admin && (
              <Select
                value={String(premium)}
                onChange={(e) => onChange({ premium: e.target.value })}
              >
                <option value=''>פרמיום</option>
                <option value='true'>כן</option>
                <option value='false'>לא</option>
              </Select>
            )}
          </div>
          <div className='flex flex-1 flex-col gap-2 md:flex-row md:justify-end self-end'>
            <div className='flex gap-2 md:max-w-xs'>
              <Input
                type='number'
                placeholder='מחיר מינימלי'
                value={minPrice}
                onChange={(e) => onChange({ minPrice: e.target.value })}
              />
              <Input
                type='number'
                placeholder='מחיר מקסימלי'
                value={maxPrice}
                onChange={(e) => onChange({ maxPrice: e.target.value })}
              />
            </div>
            <div className='flex justify-end gap-4'>
              <Button type='button' onClick={onApply}>
                החלת סינון
              </Button>
              <Button
                type='button'
                className='bg-gray-400'
                onClick={handleReset}
              >
                איפוס
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
