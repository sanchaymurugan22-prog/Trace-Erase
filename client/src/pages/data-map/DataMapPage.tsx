// Data map: who has your data and who they passed it to.
import { useEffect, useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { AppShell } from '@/components/layout/AppShell';
import { ButtonLink, Card, EmptyState, ErrorBox, PageLoading, Segmented } from '@/components/ui';
import { MapCanvas, STATUS_COLOR, type Selection } from './MapCanvas';
import { MapDetail } from './MapDetail';

export default function DataMapPage() {
  const t = useT();
  const { data, loading, error } = useApi<any>('/map');
  const [sel, setSel] = useState<Selection>(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    if (data && !sel) setSel(data.partners[0] ? { type: 'partner', id: data.partners[0].id } : data.companies[0] ? { type: 'company', id: data.companies[0].id } : null);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <AppShell><PageLoading /></AppShell>;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1"><h1 className="text-4xl font-extrabold tracking-tight">{t('Data map')}</h1><p className="text-mute">{t("Who has your data and who they passed it to, from the companies' own replies.")}</p></div>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: t('Everything') }, { value: 'shared', label: t('Only shared') }, { value: 'leaks', label: t('Leaks') }]} />
      </div>
      <ErrorBox error={error} />
      {!data?.companies.length ? (
        <Card><EmptyState icon="map" title="Nothing to map yet" action={<ButtonLink to="/onboarding/connect">{t('Run the AI scan')}</ButtonLink>}>{t('Once companies are found and reply to your requests, you will see where your data went.')}</EmptyState></Card>
      ) : (
        <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] gap-6 max-[1100px]:grid-cols-1">
          <Card className="gap-3 p-5">
            <MapCanvas data={data} filter={filter} sel={sel} onSelect={setSel} />
            <div className="flex flex-wrap gap-[18px] px-2 py-1 text-[13px] text-ink2">
              <span className="flex items-center gap-1.5"><span className="w-[22px] border-t-2 border-line2" />{t('Shared (company said so)')}</span>
              <span className="flex items-center gap-1.5"><span className="w-[22px] border-t-2 border-[#A3470A]" />{t('Ignored your deletion')}</span>
              <span className="flex items-center gap-1.5"><span className="w-[22px] border-t-2 border-dashed border-[#B42318]" />{t('Leak')}</span>
              {[['partial', 'Partly deleted'], ['claimed', 'Says deleted'], ['verified', 'Verified'], ['not-asked', 'Not asked yet']].map(([k, l]) => (
                <span key={k} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />{t(l)}</span>
              ))}
            </div>
          </Card>
          {sel ? <MapDetail id={sel.id} key={sel.id} /> : <Card />}
        </div>
      )}
    </AppShell>
  );
}
