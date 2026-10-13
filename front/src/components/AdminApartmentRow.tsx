import { Button } from './ui';
import { AdminApartmentRowProps } from '../types/component.types';
import { formatPrice } from '../lib/format';

export function AdminApartmentRow({
  apartment,
  
  onEdit,
  onDelete,
}: AdminApartmentRowProps) {
  return (
    <tr className='border-b border-border text-[11px] last:border-0 hover:bg-gray-50 transition-colors'>
      <td className='py-2 pl-4 pr-6'>{apartment.street}</td>
      <td className='py-2 pl-4'>{apartment.city}</td>
      <td className='py-2 pl-4 font-medium'>{formatPrice(apartment.price)}</td>
      <td className='py-2 pl-4'>{apartment.rooms}</td>
      <td className='py-2 pl-4'>{apartment.size}</td>
      <td className='py-2 pl-4'>{apartment.type}</td>
      <td className='py-2 pl-0 text-left'>
        <div className='flex justify-center gap-2'>
          <Button
            type='button'
            className='px-3 py-1 text-xs'
            onClick={() => onEdit(apartment)}
          >
            עריכה
          </Button>
          <Button
            type='button'
            className='px-3 py-1 !text-black text-xs bg-white  border border-border hover:bg-destructive/10
            hover:!text-white'
            onClick={() => onDelete(apartment._id)}
          >
            מחיקה
          </Button>
        </div>
      </td>
    </tr>
  );
}
