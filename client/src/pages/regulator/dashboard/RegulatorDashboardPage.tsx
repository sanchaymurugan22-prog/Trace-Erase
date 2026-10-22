// Regulator console (Data Protection Board officers only): complaints with verified evidence and AI-found patterns.
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDate } from '@/lib/format';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { AiTag, Card, Chip, EmptyState, ErrorBox, Icon, PageLoading } from '@/components/ui';
import type { RegulatorOverview } from '@/types/api';

export default function RegulatorDashboardPage() {
  const t = useT();
  const { data: d, loading, error } = useApi<RegulatorOverview>('/regulator/overview', { interval: 10000 });
  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !d) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;
  const max = Math.max(1, ...d.offenders.map(o => o.complaints + o.leaks + o.ignored));

  return (
    <RegulatorShell>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Data Protection Board · prototype console')}</span>
        <h1 className="text-4xl font-extrabold tracking-tight">{t('Complaints overview')}</h1>
        <p className="text-mute">{t('Every complaint arrives with fingerprinted evidence, ready to act on.')}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('Complaints filed')} value={d.kpis.complaints} />
        <Kpi label={t('With ledger evidence')} value={d.kpis.withEvidence} tone="text-ok" />
        <Kpi label={t('Companies named')} value={d.kpis.companies} />
        <Kpi label={t('Leaks traced')} value={d.kpis.leaks} tone="text-leak" />
      </div>

      {d.pattern && (
        <Card className="gap-3.5 border-[1.5px] border-[#E7A39C] p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AiTag ai={d.pattern._ai} label={t('AI found a pattern across complaints')} />
            <Chip tone={d.pattern.priority === 'high' ? 'leak' : 'nr'} icon="siren">{d.pattern.priority === 'high' ? t('High priority') : d.pattern.priority === 'low' ? t('Low priority') : t('Medium priority')}</Chip>
          </div>
          <h2 className="text-2xl font-extrabold">{t(d.pattern.headline)}</h2>
          <p className="text-mute">{t(d.pattern.explanation)}</p>
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="gap-0 overflow-hidden p-0">
          <h2 className="px-6 py-[18px] text-xl font-bold">{t('Complaint queue')}</h2>
          {!d.complaints.length ? <EmptyState icon="scale" title="No complaints yet">{t('Complaints filed by TraceErase users appear here with their evidence.')}</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>{t('Reference')}</th><th>{t('Against')}</th><th>{t('Issue')}</th><th>{t('Evidence')}</th><th>{t('Filed')}</th></tr></thead>
                <tbody>
                  {d.complaints.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono font-semibold" translate="no">{c.reference}</td>
                      <td className="font-semibold" translate="no">{c.against.join(', ')}</td>
                      <td className="text-sm text-mute">{t(c.issue)}</td>
                      <td><Chip tone="ok" icon="check">{t('{n} verified', { n: c.evidence })}</Chip></td>
                      <td className="whitespace-nowrap text-mute">{fmtDate(c.filedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold">{t('Repeat offenders')}</h2>
          {d.offenders.length ? d.offenders.slice(0, 6).map(o => (
            <div key={o.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold" translate="no">{o.name}</span><span className="text-[13px] text-mute">{t('{c} complaints · {i} ignored · {l} leaks', { c: o.complaints, i: o.ignored, l: o.leaks })}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-soft2"><span className="block h-full rounded-full bg-leak" style={{ width: `${(100 * (o.complaints + o.leaks + o.ignored)) / max}%` }} /></div>
            </div>
          )) : <span className="text-sm text-mute">{t('None yet.')}</span>}
          <span className="flex items-start gap-2 rounded-xl bg-soft p-3 text-[13px] text-mute"><Icon name="info" size="sm" className="mt-0.5" />{t('Scores combine filed complaints, deletion requests ignored past the deadline, and leaks traced through protected addresses.')}</span>
        </Card>
      </div>
    </RegulatorShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="gap-2">
      <span className="text-sm font-semibold text-mute">{label}</span>
      <span className={`font-display text-[40px] font-extrabold leading-[44px] ${tone || ''}`}>{value}</span>
    </Card>
  );
}
