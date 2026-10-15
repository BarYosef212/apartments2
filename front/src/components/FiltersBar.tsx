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

  const selectClass = 'min-w-0';

  return (
    <div className='sticky top-20 z-20 border-b border-line bg-sand/95 backdrop-blur'>
      <div className='mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 md:px-10'>
        <SearchInput
          value={search}
          onChange={(value: any) => onChange({ search: value })}
        />
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
          <div
            className={`grid flex-1 gap-2 ${
              admin ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'
            }`}
          >
            <Select
              aria-label='סוג עסקה'
              className={selectClass}
              value={dealType}
              onChange={(e) => onChange({ dealType: e.target.value })}
            >
              <option value=''>מכירה והשכרה</option>
              <option value='sale'>למכירה</option>
              <option value='rent'>להשכרה</option>
            </Select>
            <Select
              aria-label='עיר'
              className={selectClass}
              value={city}
              onChange={(e) => onChange({ city: e.target.value })}
            >
              <option value=''>כל הערים</option>
              {cities.map((cityName) => (
                <option key={cityName} value={cityName}>
                  {cityName}
                </option>
              ))}
            </Select>
            <Select
              aria-label='סוג נכס'
              className={selectClass}
              value={type}
              onChange={(e) => onChange({ type: e.target.value })}
            >
              <option value=''>כל סוגי הנכסים</option>
              {types.map((typeName) => (
                <option key={typeName} value={typeName}>
                  {typeName}
                </option>
              ))}
            </Select>
            <Select
              aria-label='חדרים'
              className={selectClass}
              value={rooms}
              onChange={(e) => onChange({ rooms: e.target.value })}
            >
              <option value=''>כל מספרי החדרים</option>
              <option value='2'>2 חדרים</option>
              <option value='3'>3 חדרים</option>
              <option value='4'>4 חדרים</option>
              <option value='5'>5 חדרים</option>
            </Select>
            {admin && (
              <Select
                aria-label='פרמיום'
                className={selectClass}
                value={String(premium)}
                onChange={(e) => onChange({ premium: e.target.value })}
              >
                <option value=''>פרמיום: הכל</option>
                <option value='true'>פרמיום בלבד</option>
              </Select>
            )}
          </div>
          <div className='flex gap-2'>
            <Input
              type='number'
              aria-label='מחיר מינימלי'
              placeholder='מחיר מ־'
              className='lg:w-32'
              value={minPrice}
              onChange={(e) => onChange({ minPrice: e.target.value })}
            />
            <Input
              type='number'
              aria-label='מחיר מקסימלי'
              placeholder='עד'
              className='lg:w-32'
              value={maxPrice}
              onChange={(e) => onChange({ maxPrice: e.target.value })}
            />
          </div>
          <div className='flex gap-2'>
            <Button type='button' className='flex-1 lg:flex-none' onClick={onApply}>
              החלת סינון
            </Button>
            <Button type='button' variant='outline' onClick={handleReset}>
              איפוס
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
