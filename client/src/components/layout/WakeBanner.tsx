// Shown while the free server starts up (it sleeps after 15 quiet minutes and takes up to a minute to wake).
import { useEffect, useState } from 'react';
import { onServerSlow } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useT } from '@/i18n/I18nProvider';
import { Spinner } from '@/components/ui';

export function WakeBanner() {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => onServerSlow(setSlow), []);
  if (!slow || !API_URL) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-5 z-[60] mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-navy px-5 py-3 text-sm text-white shadow-[0_12px_32px_rgba(10,22,48,.35)]">
      <Spinner className="text-accent-b" />
      <span>{t('Starting the TraceErase server. On the free plan this can take up to a minute the first time.')}</span>
    </div>
  );
}
