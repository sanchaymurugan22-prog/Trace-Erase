// One receipt from the ledger, with its proof.
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, ButtonLink, Card, Chip, CompanyAvatar, DarkPanel, ErrorBox, Icon, KeyValue, PageLoading, Tile } from '@/components/ui';

const KIND: Record<string, string> = { share: 'Disclosure receipt', deletion: 'Deletion receipt', 'request-signature': 'Signed request', evidence: 'Evidence record', complaint: 'Complaint record', certificate: 'Certificate', message: 'Delivery record' };

export default function ReceiptPage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const navigate = useNavigate();
  const { data: r, loading, error } = useApi<any>('/receipts/' + params.id);
  if (loading) return <AppShell active="/app/evidence"><PageLoading /></AppShell>;
  if (error || !r) return <AppShell active="/app/evidence"><ErrorBox error={error} /></AppShell>;
  const v = r.verification;
  const d = r.data || {};
  const share = r.kind === 'share';
  const proof: [string, string][] = [['Receipt fingerprint', r.hash], ...(v.batch
    ? [['Batch', `#${v.batch.number} · ${t('{n} receipts', { n: v.batch.size })}`], ['Anchored', fmtDateTime(v.batch.anchoredAt)], ['Merkle root', v.batch.root], ...(v.batch.txHash ? [['Transaction', v.batch.txHash]] : [])] as [string, string][]
    : [['Status', t('Bundled into the next batch within a minute')]] as [string, string][])];

  return (
    <AppShell active="/app/evidence">
      <nav className="flex items-center gap-2 text-sm"><Link to="/app/evidence" className="font-semibold">{t('Evidence and proof')}</Link><Icon name="cr" size="sm" className="text-mute" /><span className="text-mute">{t('Receipt')}</span></nav>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 max-[1100px]:grid-cols-1">
        <Card className="gap-[22px] p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1"><span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t(KIND[r.kind] || 'Receipt')}</span><h1 className="text-[28px] font-bold leading-9">{t(r.title)}</h1></div>
            {v.valid ? <Chip tone="ok" icon="shieldc">{t('Verified on ledger')}</Chip> : v.anchored ? <Chip tone="leak">{t('Check failed')}</Chip> : <Chip tone="pend" icon="clock">{t('Waiting for next batch')}</Chip>}
          </div>
          {share && r.partner && (
            <div className="flex flex-wrap items-center gap-5 rounded-[18px] bg-soft p-6">
              <div className="flex items-center gap-3"><CompanyAvatar company={r.company} /><span className="flex flex-col"><span className="text-[13px] text-mute">{t('From')}</span><span className="text-[17px] font-bold" translate="no">{r.company.name}</span></span></div>
              <span className="h-0.5 min-w-10 flex-1 bg-[repeating-linear-gradient(90deg,var(--color-line2)_0_6px,transparent_6px_12px)]" />
              <Chip tone="brand" icon="mail">{(d.fields || []).map((f: string) => t(f)).join(', ')}</Chip>
              <span className="h-0.5 min-w-10 flex-1 bg-[repeating-linear-gradient(90deg,var(--color-line2)_0_6px,transparent_6px_12px)]" />
              <div className="flex items-center gap-3"><CompanyAvatar company={r.partner} /><span className="flex flex-col"><span className="text-[13px] text-mute">{t('To')}</span><span className="text-[17px] font-bold" translate="no">{r.partner.name}</span></span></div>
            </div>
          )}
          <div className="flex flex-col">
            <KeyValue label={t('Issued')}>{fmtDateTime(r.issuedAt)}</KeyValue>
            <KeyValue label={t('Source')}>{t(r.signedBy)}</KeyValue>
            {share && <><KeyValue label={t('Purpose')}>{t(d.purpose)}</KeyValue><KeyValue label={t('Allowed to keep until')}>{d.keepUntil ? fmtDate(d.keepUntil, { year: true }) : t('Not stated')}</KeyValue></>}
            {d.deleted && <KeyValue label={t('Deleted')}>{d.deleted.map((x: string) => t(x)).join(', ') || '—'}</KeyValue>}
            {d.kept?.length > 0 && <KeyValue label={t('Kept by law')}>{d.kept.map((k: any) => `${t(k.field || k.what)} (${t(k.law || k.why)})`).join('; ')}</KeyValue>}
            {d.request && <KeyValue label={t('Request')}>{d.request}</KeyValue>}
            {d.reference && <KeyValue label={t('Reference')}>{d.reference}</KeyValue>}
            <KeyValue label={t('Receipt ID')}><span className="font-mono text-sm" translate="no">{r.id}</span></KeyValue>
          </div>
          <div className="flex flex-wrap gap-2">
            {r.evidenceTargetId && r.kind !== 'evidence' && (
              <ActionButton onClick={async () => { const p = await post<{ id: string }>('/evidence', { targetId: r.evidenceTargetId }); navigate(`/app/evidence/${p.id}`); }}>
                <Icon name="scale" />{t('Use as evidence')}
              </ActionButton>
            )}
            <ButtonLink to={`/verify/${r.id}`} variant="secondary"><Icon name="share" />{t('Public verify page')}</ButtonLink>
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <DarkPanel className="gap-1">
            <div className="flex items-center justify-between pb-2"><span className="flex items-center gap-2 text-[17px] font-bold text-white"><Icon name="cube" className="text-accent-b" />{t('Ledger proof')}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-semibold">{t(v.batch?.network || 'Pending')}</span></div>
            {proof.map(([k, val]) => (
              <div key={k} className="flex flex-col gap-1 border-b border-white/8 py-3">
                <span className="text-[13px] text-onm">{t(k)}</span>
                {String(val).startsWith('0x') ? <span className="break-all rounded-lg bg-white/6 px-2 py-1 font-mono text-xs text-on" translate="no">{val}</span> : <span className="font-semibold text-white">{val}</span>}
              </div>
            ))}
            {v.anchored && <span className="pt-2 text-[13px] text-accent-b">{t('Checks')}: {t('intact')} {v.intact ? '✓' : '✗'} · {t('in batch')} {v.inBatch ? '✓' : '✗'} · {t('chain')} {v.chainOk ? '✓' : '✗'}</span>}
          </DarkPanel>
          <Card>
            <h2 className="text-[17px] font-bold">{t('What this means')}</h2>
            <div className="flex flex-col gap-3 text-sm text-ink2">
              <span className="flex items-start gap-3"><Tile icon="lock" tone="accent" size="sm" />{t('Only a fingerprint is anchored. Your personal data is not.')}</span>
              <span className="flex items-start gap-3"><Tile icon="edit" tone="accent" size="sm" />{t('If anyone changes this receipt, the fingerprint stops matching.')}</span>
              {share && <span className="flex items-start gap-3"><Tile icon="scale" tone="accent" size="sm" />{t('{from} said in writing that it gave your data to {to}.', { from: r.company?.name, to: r.partner?.name })}</span>}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
