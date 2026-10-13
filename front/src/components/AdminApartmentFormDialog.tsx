import React, { useEffect, useState } from 'react';
import { Button, Input, Select, FormLabel } from './ui';
import {
  ApartmentFormState,
  AdminApartmentFormDialogProps,
} from '../types/component.types';

const emptyForm: ApartmentFormState = {
  images: '',
  price: 0,
  street: '',
  city: '',
  type: '',
  info: '',
  rooms: 0,
  floor: 0,
  size: '',
  tags: '',
  premium:false,
  dealType: '',
};

export function AdminApartmentFormDialog({
  isOpen,
  initialData,
  isSaving,
  types = [],

  onClose,
  onSave,
}: AdminApartmentFormDialogProps) {
  const [form, setForm] = useState<ApartmentFormState>(emptyForm);

  useEffect(() => {
    if (initialData) {
      setForm({
        images: (initialData.images?.length
          ? initialData.images
          : [initialData.img].filter(Boolean)
        ).join('\n'),
        price: initialData.price,
        street: initialData.street,
        city: initialData.city,
        type: initialData.type,
        info: initialData.info,
        rooms: initialData.rooms,
        floor: initialData.floor,
        size: initialData.size,
        tags: initialData.tags.join(', '),
        premium: initialData.premium ? true : false,
        dealType: initialData.dealType ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [initialData, isOpen]);

  function handleChange(key: keyof ApartmentFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave(form);
  }

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm'>
      <div className='w-full max-w-lg bg-white p-6 animate-in fade-in zoom-in duration-200'>
        <h2 className='mb-6 font-display text-4xl font-light leading-none'>
          {initialData ? 'עריכת דירה' : 'הוספת דירה חדשה'}
        </h2>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-1'>
              <FormLabel required={true}>עיר</FormLabel>
              <Input
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder='לדוגמה: תל אביב'
                required
              />
            </div>
            <div className='space-y-1'>
              <FormLabel required={true}>רחוב</FormLabel>
              <Input
                value={form.street}
                onChange={(e) => handleChange('street', e.target.value)}
                placeholder='לדוגמה: דיזנגוף 100'
                required
              />
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-1'>
              <FormLabel required={false}>מחיר</FormLabel>

              <Input
                value={form.price || ''}
                onChange={(e) => handleChange('price', e.target.value)}
                type='number'
                min={0}
                placeholder='₪ (ריק = לא צוין מחיר)'
              />
            </div>
            <div className='space-y-1'>
              <FormLabel required={true}>סוג נכס</FormLabel>

              <Select
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
                required
              >
                <option value=''>בחר סוג...</option>
                {types.length > 0
                  ? types.map((typeOption) => (
                      <option key={typeOption} value={typeOption}>
                        {typeOption}
                      </option>
                    ))
                  : null}
              </Select>
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <div className='space-y-1'>
              <FormLabel required={true}>חדרים</FormLabel>

              <Input
                value={form.rooms}
                onChange={(e) => handleChange('rooms', e.target.value)}
                type='number'
                step='0.5'
              />
            </div>
            <div className='space-y-1'>
              <FormLabel required={true}> גודל (מ"ר)</FormLabel>

              <Input
                value={form.size}
                onChange={(e) => handleChange('size', e.target.value)}
                type='number'
              />
            </div>
            <div className='space-y-1'>
              <FormLabel required={false}>קומה</FormLabel>

              <Input
                value={form.floor}
                onChange={(e) => handleChange('floor', e.target.value)}
                type='number'
              />
            </div>
          </div>

          <div className='space-y-1'>
            <FormLabel required={false}>
              קישורים לתמונות (אחד בכל שורה, הראשון הוא התמונה הראשית)
            </FormLabel>

            <textarea
              value={form.images}
              onChange={(e) => handleChange('images', e.target.value)}
              placeholder='https://...'
              dir='ltr'
              rows={4}
              className='w-full border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            />
          </div>

          <div className='space-y-1'>
            <FormLabel required={false}>תגיות (מופרדות בפסיק)</FormLabel>
            <Input
              value={form.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder='משופצת, מוארת, מעלית...'
            />
          </div>

          <div className='space-y-1'>
            <FormLabel required={false}>תיאור נוסף</FormLabel>
            <Input
              value={form.info}
              onChange={(e) => handleChange('info', e.target.value)}
            />
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-1'>
              <FormLabel required={false}>סוג עסקה</FormLabel>

              <Select
                value={form.dealType}
                onChange={(e) => handleChange('dealType', e.target.value)}
              >
                <option value=''>לא צוין</option>
                <option value='sale'>למכירה</option>
                <option value='rent'>להשכרה</option>
              </Select>
            </div>
            <div className='space-y-1'>
              <FormLabel required={false}>פרימיום</FormLabel>

              <Select
                value={form.premium ? 'yes' : 'no'}
                onChange={(e) =>
                  handleChange(
                    'premium',
                    e.target.value === 'yes' ? 'true' : 'false',
                  )
                }
              >
                <option value='no'>לא</option>
                <option value='yes'>כן</option>
              </Select>
            </div>
          </div>
          <div className='mt-6 flex justify-end gap-3'>
            <Button
              type='button'
              className='bg-white !text-ink border border-line hover:bg-sand'
              onClick={onClose}
            >
              ביטול
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
