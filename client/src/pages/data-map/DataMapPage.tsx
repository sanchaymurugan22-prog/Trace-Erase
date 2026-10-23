// Data map: who has your data and who they passed it to.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { AppShell } from '@/components/layout/AppShell';
import { Button, ButtonLink, Card, EmptyState, ErrorBox, Icon, PageLoading, Segmented } from '@/components/ui';
import { MapCanvas, STATUS_COLOR, type Selection } from './MapCanvas';
import { MapDetail } from './MapDetail';

export default function DataMapPage() {
  const t = useT();
  const [limit, setLimit] = useState(12);
  const { data, loading, error } = useApi<any>('/map?limit=' + limit);
  const [sel, setSel] = useState<Selection>(null);
  const [filter, setFilter] = useState('all');
  if (loading && !data) return <AppShell><PageLoading /></AppShell>;
  const kind = sel?.type === 'kind' ? data?.partners.find((p: any) => p.id === sel.id) : null;
  const kindCompanies = kind ? data.companies.filter((c: any) => data.edges.some((e: any) => e.from === c.id && e.to === kind.id)) : [];

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
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(300px,1fr)] gap-6 max-[1300px]:grid-cols-1">
          <Card className="gap-3 p-4">
            <MapCanvas data={data} filter={filter} sel={sel} onSelect={setSel} />
            <div className="flex flex-wrap gap-[18px] px-2 py-1 text-[13px] text-ink2">
              <span className="flex items-center gap-1.5"><span className="w-[22px] border-t-2 border-line2" />{t('Shared (company said so)')}</span>
              <span className="flex items-center gap-1.5"><span className="w-[22px] border-t-2 border-[#A3470A]" />{t('Ignored your deletion')}</span>
              <span className="flex items-center gap-1.5"><span className="w-[22px] border-t-2 border-dashed border-[#B42318]" />{t('Leak')}</span>
              <span className="flex items-center gap-1.5"><span className="w-[22px] border-t-2 border-dashed border-[#C4CDDC]" />{t('Likely: kinds of partners their privacy policy names')}</span>
              {[['partial', 'Partly deleted'], ['claimed', 'Says deleted'], ['verified', 'Verified'], ['not-asked', 'Not asked yet']].map(([k, l]) => (
                <span key={k} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />{t(l)}</span>
              ))}
            </div>
            {data.total > data.companies.length || limit > 12 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 pt-3 text-sm text-mute">
                <span>{t('Showing {n} of {total} companies', { n: data.companies.length, total: data.total })}</span>
                {data.total > data.companies.length
                  ? <Button variant="secondary" size="sm" onClick={() => setLimit(60)}><Icon name="plus" size="sm" />{t('Show all companies')}</Button>
                  : <Button variant="ghost" size="sm" onClick={() => setLimit(12)}>{t('Show fewer')}</Button>}
              </div>
            ) : null}
          </Card>
          {kind ? (
            <Card className="gap-3">
              <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Likely partners')}</span>
              <span className="text-xl font-bold">{t(kind.name)}</span>
              <span className="text-sm text-ink2">{t('These companies say in their privacy policies that they share data with this kind of partner. When they answer your deletion request, AI reads the reply for the real names, and the map shows them.')}</span>
              <div className="flex flex-col">{kindCompanies.map((c: any) => <button key={c.id} type="button" onClick={() => setSel({ type: 'company', id: c.id })} className="border-b border-line py-2.5 text-left text-sm font-semibold text-ink last:border-b-0 hover:text-brand" translate="no">{c.name}</button>)}</div>
              <ButtonLink to="/app/delete" variant="secondary" full>{t('Ask them to delete')}</ButtonLink>
            </Card>
          ) : sel ? <MapDetail id={sel.id} key={sel.id} /> : (
            <Card className="gap-2 text-sm text-ink2">
              <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('How to read the map')}</span>
              <span>{t('Click any company to see who it shares your data with. Solid lines are partners a company named in its reply; dashed lines are the kinds of partners its privacy policy says it shares with.')}</span>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
