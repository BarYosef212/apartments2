import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { Card } from './ui';

interface Lead {
  _id: string;
  name: string;
  phone: string;
  email: string;
  reason: 'viewing' | 'valuation' | 'general';
  message: string;
  apartment: { id: string; street: string; city: string } | null;
  emailStatus: 'sent' | 'failed' | 'not_configured';
  createdAt: string;
}

const REASON_LABELS: Record<Lead['reason'], string> = {
  viewing: 'ביקור בנכס',
  valuation: 'מכירה / השכרה',
  general: 'כללי',
};

const EMAIL_STATUS: Record<Lead['emailStatus'], { label: string; className: string }> = {
  sent: { label: 'נשלח במייל', className: 'text-emerald-700' },
  failed: { label: 'המייל נכשל', className: 'text-red-700' },
  not_configured: { label: 'מייל לא מוגדר', className: 'text-amber-700' },
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export function AdminLeadsPanel() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Lead[]>('/admin/leads', { params: { limit: 100 } })
      .then((res) => setLeads(res.data))
      .catch(() => setError('שגיאה בטעינת הפניות.'));
  }, []);

  if (error) {
    return <p className='border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</p>;
  }
  if (!leads) {
    return <div className='animate-pulse py-16 text-center text-sm text-taupe'>טוען…</div>;
  }

  const unsent = leads.filter((l) => l.emailStatus !== 'sent').length;

  return (
    <div className='space-y-4'>
      {unsent > 0 && (
        <p className='border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
          {unsent} פניות לא נשלחו במייל. הן שמורות כאן. כדי שיישלחו, יש להגדיר מייל
          לקבלת טפסים בהגדרות האתר ואת פרטי שרת המייל (SMTP) בשרת.
        </p>
      )}
      <Card className='overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-right text-sm'>
            <thead className='border-b border-line bg-sand text-taupe'>
              <tr>
                <th className='py-3 pl-4 pr-6 font-medium'>מועד</th>
                <th className='py-3 pl-4 font-medium'>סיבה</th>
                <th className='py-3 pl-4 font-medium'>שם</th>
                <th className='py-3 pl-4 font-medium'>טלפון</th>
                <th className='py-3 pl-4 font-medium'>נכס</th>
                <th className='py-3 pl-4 font-medium'>הודעה</th>
                <th className='py-3 pl-4 font-medium'>מייל</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-line bg-white'>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className='py-12 text-center text-taupe'>
                    עדיין אין פניות מהאתר.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead._id} className='align-top'>
                    <td className='whitespace-nowrap py-3 pl-4 pr-6 tabular-nums'>
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className='whitespace-nowrap py-3 pl-4'>{REASON_LABELS[lead.reason]}</td>
                    <td className='py-3 pl-4'>
                      <div className='font-medium'>{lead.name}</div>
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className='break-all text-xs text-taupe hover:text-ink'>
                          {lead.email}
                        </a>
                      )}
                    </td>
                    <td className='whitespace-nowrap py-3 pl-4'>
                      <a href={`tel:${lead.phone}`} dir='ltr' className='hover:underline'>
                        {lead.phone}
                      </a>
                    </td>
                    <td className='py-3 pl-4'>
                      {lead.apartment ? (
                        <Link to={`/apartments/${lead.apartment.id}`} className='hover:underline'>
                          {lead.apartment.street}, {lead.apartment.city}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className='max-w-xs whitespace-pre-line py-3 pl-4 text-taupe'>
                      {lead.message || '—'}
                    </td>
                    <td
                      className={`whitespace-nowrap py-3 pl-4 text-xs ${EMAIL_STATUS[lead.emailStatus].className}`}
                    >
                      {EMAIL_STATUS[lead.emailStatus].label}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
