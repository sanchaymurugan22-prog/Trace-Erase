// Evidence and proof: complaints, evidence packs, certificates and every receipt on the ledger.
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Chip, EmptyState, Icon, PageLoading, StatusChip, Tile } from '@/components/ui';
import type { Complaint, DeletionRequest, EvidencePack, Receipt } from '@/types/api';

export default function EvidencePage() {
  const t = useT();
  const { data: packs, loading } = useApi<EvidencePack[]>('/evidence');
  const { data: receipts } = useApi<(Receipt & { status?: string })[]>('/receipts');
  const { data: complaints } = useApi<Complaint[]>('/complaints');
  const { data: requests } = useApi<DeletionRequest[]>('/requests');
  const certs = (requests || []).filter(r => r.certificateId);
  const nothing = !packs?.length && !complaints?.length && !certs.length;

  return (
    <AppShell>
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-extrabold tracking-tight">{t('Evidence and proof')}</h1>
        <p className="text-mute">{t('Every important step gets a receipt: proof of what happened and when. Receipts are sealed so nobody can change them later, and anyone can check one on the Verify page.')}</p>
      </div>
      {loading ? <PageLoading /> : (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            <Kpi label={t('Receipts')} value={receipts?.length ?? 0} sub={t('Proof of each request, reply, sharing and leak')} />
            <Kpi label={t('Evidence packs')} value={packs?.length ?? 0} sub={t('Ready for complaints')} />
            <Kpi label={t('Complaints')} value={complaints?.length ?? 0} sub={t('{n} filed', { n: (complaints || []).filter(c => c.status === 'filed').length })} />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card className="gap-0 overflow-hidden p-0">
              <h2 className="px-6 py-[18px] text-xl font-bold">{t('Complaints, packs and certificates')}</h2>
              {nothing ? (
                <EmptyState icon="file" title="No evidence yet">{t('Packs are built automatically when a company ignores you or a leak is caught.')}</EmptyState>
              ) : (
                <div className="flex flex-col px-6 pb-3">
                  {(complaints || []).map(c => (
                    <Row key={c.id} to={`/app/complaints/${c.id}`} icon="scale" tone="nr"
                      title={c.reference ? t('Complaint {ref}', { ref: c.reference }) : t('Complaint (draft)')}
                      sub={t('Against {names}', { names: c.parties.map(p => p.name).join(', ') })}>
                      <StatusChip status={c.status === 'filed' ? 'filed' : 'draft'} short />
                    </Row>
                  ))}
                  {(packs || []).map(p => (
                    <Row key={p.id} to={`/app/evidence/${p.id}`} icon="file" tone="accent"
                      title={`${p.number}: ${p.title}`} sub={`${t('{n} records', { n: p.items.length })} · ${fmtDate(p.builtAt)}`} />
                  ))}
                  {certs.map(r => (
                    <Row key={r.certificateId!} to={`/app/certificates/${r.certificateId}`} icon="shieldc" tone="ok"
                      title={t('Deletion certificate for {number}', { number: r.number })} sub={t('{done} of {total} resolved', { done: r.resolved, total: r.total })} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex items-center justify-between px-6 py-[18px]">
                <h2 className="text-xl font-bold">{t('Receipts')}</h2>
                <Chip>{receipts?.length || 0}</Chip>
              </div>
              <div className="mx-6 mb-3 flex flex-col gap-1.5 rounded-xl bg-soft p-3.5 text-[13px] text-ink2">
                <span><b>{t('Deletion request signed')}</b>: {t('proof that you asked, and when. The 30-day legal deadline counts from here.')}</span>
                <span><b>{t('Company reply')}</b>: {t('proof of what the company said, deleted or kept.')}</span>
                <span><b>{t('Deletion certificate')}</b>: {t('one summary of the whole request: who deleted, who kept what, who ignored you.')}</span>
                <span><b>{t('Sealed')}</b>: {t('locked so it cannot be changed. Click a receipt to see it, or share its verify page.')}</span>
              </div>
              {!receipts?.length ? <EmptyState icon="hash" title="No receipts yet">{t('Every request, reply and leak creates one.')}</EmptyState> : (
                <div className="max-h-[560px] overflow-auto">
                  <table className="table">
                    <tbody>
                      {receipts.map(r => (
                        <tr key={r.id}>
                          <td>
                            <Link to={`/app/receipts/${r.id}`} className="text-sm font-semibold">{t(r.title)}</Link>
                            <div className="text-[13px] text-mute">{fmtDateTime(r.issuedAt)}</div>
                          </td>
                          <td className="text-right">
                            {r.status === 'anchored' ? <Chip tone="ok" icon="shieldc">{t('Sealed')}</Chip> : <Chip tone="pend" icon="clock">{t('Sealing…')}</Chip>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card className="gap-2">
      <span className="text-sm font-semibold text-mute">{label}</span>
      <span className="font-display text-[40px] font-extrabold leading-[44px]">{value}</span>
      <span className="text-[13px] text-mute">{sub}</span>
    </Card>
  );
}

function Row({ to, icon, tone, title, sub, children }: { to: string; icon: 'scale' | 'file' | 'shieldc'; tone: 'nr' | 'accent' | 'ok'; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <Link to={to} className="flex min-h-[68px] items-center gap-3 border-b border-line py-2.5 text-ink last:border-b-0 hover:text-ink">
      <Tile icon={icon} tone={tone} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold">{title}</span><span className="text-[13px] text-mute">{sub}</span></span>
      {children}
      <Icon name="cr" size="sm" className="text-mute" />
    </Link>
  );
}
