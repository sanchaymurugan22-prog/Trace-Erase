// All deletion requests the user has signed.
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDate } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ButtonLink, Card, CardLink, EmptyState, ErrorBox, Icon, PageLoading, Ring, StatusChip, STATUS } from '@/components/ui';
import type { DeletionRequest } from '@/types/api';

export default function RequestsPage() {
  const t = useT();
  const { data, loading, error } = useApi<DeletionRequest[]>('/requests');
  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1"><h1 className="text-4xl font-extrabold tracking-tight">{t('Deletion requests')}</h1><p className="text-mute">{t('Every request you signed, with live status per company.')}</p></div>
        <ButtonLink to="/app/delete"><Icon name="plus" />{t('New request')}</ButtonLink>
      </div>
      <ErrorBox error={error} />
      {loading ? <PageLoading /> : !data?.length ? (
        <Card><EmptyState icon="trash" title="No requests yet" action={<ButtonLink to="/app/delete">{t('Choose what to delete')}</ButtonLink>}>{t('Choose companies and sign one request. We send it everywhere and follow up for you.')}</EmptyState></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {data.map(r => (
            <CardLink key={r.id} to={`/app/requests/${r.id}`} className="flex-row flex-wrap items-center gap-6">
              <Ring pct={Math.round((100 * r.resolved) / Math.max(1, r.total))} size={84} color="var(--color-accent)"><span className="text-sm font-bold">{r.resolved}/{r.total}</span></Ring>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[13px] text-mute">{t('{number} · signed {date} · day {day}', { number: r.number, date: fmtDate(r.signedAt, { year: true }), day: r.day })}</span>
                <span className="text-xl font-bold" translate="no">{r.targets.map(x => x.company.name).slice(0, 4).join(', ')}{r.total > 4 ? ` +${r.total - 4}` : ''}</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(r.counts).map(([s, n]) => <StatusChip key={s} status={s} label={`${n} · ${t((STATUS[s] || [])[2] || s)}`} />)}
                </div>
              </div>
              <StatusChip status={r.status} />
            </CardLink>
          ))}
        </div>
      )}
    </AppShell>
  );
}
