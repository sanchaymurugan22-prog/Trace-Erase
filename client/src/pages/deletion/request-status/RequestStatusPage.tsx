// One deletion request: progress, escalation, and every company's status.
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { useToast, ActionButton, Banner, ButtonLink, Card, Chip, CompanyAvatar, ErrorBox, Icon, PageLoading, Ring, StatusChip } from '@/components/ui';
import { EscalationSteps } from '@/components/shared/EscalationSteps';
import type { DeletionRequest } from '@/types/api';

export default function RequestStatusPage({ params }: { params: Record<string, string> }) {
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const { data: r, loading, error, reload } = useApi<DeletionRequest & { autoEscalate?: boolean }>('/requests/' + params.id, { interval: 5000 });
  if (loading) return <AppShell active="/app/requests"><PageLoading /></AppShell>;
  if (error || !r) return <AppShell active="/app/requests"><ErrorBox error={error} /></AppShell>;
  const overdue = r.targets.find(x => x.status === 'overdue' && x.complaintId);
  const cert = async () => { const c = await post(`/requests/${r.id}/certificate`); navigate(`/app/certificates/${c.id}`); };

  return (
    <AppShell active="/app/requests">
      <nav className="flex items-center gap-2 text-sm"><Link to="/app/requests" className="font-semibold">{t('Deletion requests')}</Link><Icon name="cr" size="sm" className="text-mute" /><span className="text-mute">{r.number}</span></nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">{t('Deleting your data from {n} companies', { n: r.total })}</h1>
          <p className="text-mute">{t(r.signature ? 'Request {number} · signed with your passkey on {date} · day {day} of 30' : 'Request {number} · signed with your account on {date} · day {day} of 30', { number: r.number, date: fmtDate(r.signedAt, { year: true }), day: r.day })}</p>
        </div>
        <div className="flex gap-2">
          <ActionButton variant="secondary" onClick={cert}><Icon name="shieldc" />{t(r.certificateId ? 'Certificate' : 'Issue certificate')}</ActionButton>
          {overdue && <ButtonLink to={`/app/complaints/${overdue.complaintId}`}><Icon name="scale" />{t('Review complaint')}</ButtonLink>}
        </div>
      </div>

      <Card className="flex-row flex-wrap items-center gap-10 px-8 py-7">
        <div className="flex items-center gap-6">
          <Ring pct={Math.round((100 * r.resolved) / Math.max(1, r.total))} size={150} color="var(--color-accent)"><span className="font-display text-[40px] font-extrabold leading-[44px]">{r.resolved}/{r.total}</span><span className="text-[13px] text-mute">{t('resolved')}</span></Ring>
          <div className="flex flex-col gap-2">{Object.entries(r.counts).map(([s, n]) => <span key={s} className="flex items-center gap-2 text-sm"><Chip className="min-w-7 justify-center">{n}</Chip><StatusChip status={s} /></span>)}</div>
        </div>
        <div className="w-px self-stretch bg-line max-[1000px]:hidden" />
        <div className="flex min-w-[420px] flex-1 flex-col gap-3 max-[700px]:min-w-0">
          <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Automatic escalation')} {r.autoEscalate === false ? `(${t('off')})` : ''}</span>
          <EscalationSteps steps={r.steps} />
        </div>
      </Card>

      {overdue && (
        <Link to={`/app/complaints/${overdue.complaintId}`} className="text-ink hover:text-ink">
          <Banner tone="warn" icon="scale"><span className="flex-1"><b>{t('{name} ignored you for {n} days.', { name: overdue.company.name, n: overdue.day })}</b> {t('Your complaint to the Data Protection Board is drafted with all evidence attached.')}</span><Chip>{t('Review')}</Chip></Banner>
        </Link>
      )}
      {r.targets.some(x => x.delivery === 'demo') && (
        <Banner tone="info" icon="play"><span className="flex-1 text-sm">{t('Sample data: these letters were written by AI and their sending is simulated. Companies reply on their own schedule, or press the button to see their replies now.')}</span>
          <ActionButton variant="secondary" size="sm" onClick={async () => { const out = await post<any[]>(`/requests/${r.id}/sample-replies`); toast(t('{n} companies replied', { n: out.length })); reload(); }}><Icon name="mail" size="sm" />{t('Get replies now')}</ActionButton>
        </Banner>
      )}
      {r.targets.some(x => x.delivery === 'email') && (
        <Banner tone="ok" icon="send"><span className="flex-1 text-sm">{t('Sent automatically. Each company got its own AI-written letter, with a copy to your email. Replies come to your inbox: open a company below and paste its reply, and AI checks it.')}</span></Banner>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>{t('Company')}</th><th>{t('Sent by')}</th><th>{t('Latest')}</th><th>{t('Result')}</th><th>{t('Proof')}</th><th /></tr></thead>
            <tbody>
              {r.targets.map(tg => {
                const last = (tg.events || []).at(-1);
                return (
                  <tr key={tg.id}>
                    <td><div className="flex items-center gap-3"><CompanyAvatar company={tg.company} size="sm" /><span className="flex flex-col"><span className="font-bold" translate="no">{tg.company.name}</span>{tg.via && <span className="text-[13px] text-mute">{t('partner of {name}', { name: tg.via.name })}</span>}</span></div></td>
                    <td className="text-mute">{t(tg.channel === 'webform' ? 'Web form' : 'Email')}</td>
                    <td><span className="flex flex-col"><span className="clamp-2 max-w-[320px] text-sm">{t(last?.text || 'Waiting to send')}</span><span className="text-[13px] text-mute">{last ? fmtDate(last.at) : ''}</span></span></td>
                    <td><StatusChip status={tg.status} short /></td>
                    <td>{tg.verifyReceiptId || tg.receiptId ? <Link to={`/app/receipts/${tg.verifyReceiptId || tg.receiptId}`} className="flex items-center gap-1.5 text-sm"><Icon name="hash" size="sm" />{t('Receipt')}</Link>
                      : tg.complaintId ? <Link to={`/app/complaints/${tg.complaintId}`} className="flex items-center gap-1.5 text-sm"><Icon name="file" size="sm" />{t('Evidence')}</Link>
                      : <span className="text-[13px] text-mute">{t('Waiting')}</span>}</td>
                    <td><Link to={`/app/requests/${r.id}/targets/${tg.id}`} className="inline-flex size-9 items-center justify-center rounded-xl border border-line text-ink2 hover:bg-soft" aria-label={t('Open {name}', { name: tg.company.name })}><Icon name="cr" size="sm" /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-5 max-[1000px]:grid-cols-1">
        <Card small><StatusChip status="verified" /><span className="text-sm text-ink2">{t('The company confirmed in a signed email, then no one used the address it knew you by for 30 days. Strongest proof.')}</span></Card>
        <Card small><StatusChip status="partial" /><span className="text-sm text-ink2">{t('Deleted everything except what a law requires it to keep, with the law named.')}</span></Card>
        <Card small><StatusChip status="claimed" /><span className="text-sm text-ink2">{t("A genuine signed email says it's deleted. AI checked it, and we keep watching for leaks.")}</span></Card>
      </div>
    </AppShell>
  );
}
