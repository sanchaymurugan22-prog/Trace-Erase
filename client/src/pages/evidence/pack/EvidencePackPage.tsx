// One evidence pack: every record, what it proves, and its fingerprint.
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { openApiPage, post } from '@/lib/api';
import { fmtDateTime, shortHash } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, ButtonLink, Card, DarkPanel, ErrorBox, Icon, PageLoading, buttonClass } from '@/components/ui';
import type { EvidencePack } from '@/types/api';

export default function EvidencePackPage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const navigate = useNavigate();
  const { data: p, loading, error } = useApi<EvidencePack>('/evidence/' + params.id);
  if (loading) return <AppShell active="/app/evidence"><PageLoading /></AppShell>;
  if (error || !p) return <AppShell active="/app/evidence"><ErrorBox error={error} /></AppShell>;

  return (
    <AppShell active="/app/evidence">
      <nav className="flex items-center gap-2 text-sm"><Link to="/app/evidence" className="font-semibold">{t('Evidence and proof')}</Link><Icon name="cr" size="sm" className="text-mute" /><span className="text-mute">{p.number}</span></nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Evidence pack')} · {p.number}</span>
          <h1 className="text-4xl font-extrabold tracking-tight">{t(p.title)}</h1>
          <p className="text-mute">{t('{n} records, each timestamped and fingerprinted on the ledger.', { n: p.items.length })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass('secondary')} onClick={() => openApiPage(`/api/docs/evidence/${p.id}`).catch(() => {})}><Icon name="download" />{t('Save as PDF')}</button>
          <ActionButton onClick={async () => { const c = await post<{ id: string }>('/complaints', { packId: p.id }); navigate(`/app/complaints/${c.id}`); }}>
            <Icon name="scale" />{t('Use in a complaint')}
          </ActionButton>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>#</th><th>{t('Record')}</th><th>{t('Source')}</th><th>{t('Time')}</th><th>{t('Fingerprint')}</th></tr></thead>
              <tbody>
                {p.items.map((it, i) => (
                  <tr key={it.receiptId}>
                    <td><span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-navy font-display text-sm font-bold text-white">{i + 1}</span></td>
                    <td><span className="flex flex-col gap-0.5"><Link to={`/app/receipts/${it.receiptId}`} className="font-bold">{t(it.label)}</Link><span className="text-[13px] text-mute">{t(it.proves)}</span></span></td>
                    <td className="text-mute">{t(it.source)}</td>
                    <td className="whitespace-nowrap text-mute">{fmtDateTime(it.at)}</td>
                    <td><code className="rounded-lg bg-soft px-2 py-1 font-mono text-[12.5px] text-ink2">{shortHash(it.hash)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-lg font-bold">{t('Together, this proves')}</h2>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {p.items.map((it, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-ink2">
                  <span className="inline-flex size-7 flex-none items-center justify-center rounded-lg bg-accent-s text-[13px] font-bold text-accent">{i + 1}</span>{t(it.proves)}
                </li>
              ))}
            </ol>
          </Card>
          <DarkPanel className="gap-3 p-6">
            <span className="flex items-center gap-2 text-lg font-bold text-white"><Icon name="cube" className="text-accent-b" />{t('Tamper-proof')}</span>
            <span className="text-sm text-onm">{t('Anyone can check these fingerprints. If a single word changes, the check fails.')}</span>
            {p.items[0] && <ButtonLink to={`/verify/${p.items[0].receiptId}`} variant="white"><Icon name="shieldc" />{t('Verify a record')}</ButtonLink>}
          </DarkPanel>
        </div>
      </div>
    </AppShell>
  );
}
