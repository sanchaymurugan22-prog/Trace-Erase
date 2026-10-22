// One leak: who got the protected address, AI's investigation of how, and what to do about it.
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, AiTag, ButtonLink, Card, Chip, ErrorBox, Icon, PageLoading, Tile, Well, useToast } from '@/components/ui';
import type { Leak } from '@/types/api';
import { LeakChain } from './LeakChain';

export default function LeakPage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: l, loading, error, reload } = useApi<Leak>('/leaks/' + params.id);
  if (loading) return <AppShell active="/app/alerts"><PageLoading /></AppShell>;
  if (error || !l) return <AppShell active="/app/alerts"><ErrorBox error={error} /></AppShell>;
  const inv = l.investigation;
  const act = (action: string) => post<any>(`/leaks/${l.id}/actions`, { action });
  const vars = { sender: l.senderName, company: l.company.name };

  return (
    <AppShell active="/app/alerts">
      <section className="flex flex-wrap items-center gap-5 rounded-[20px] border border-[#F6C4BF] bg-leak-s p-7">
        <Tile icon="siren" tone="leak" size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Chip tone="leak" className="self-start">{t('Leak detected')} · {fmtDateTime(l.at)}</Chip>
          <h1 className="text-[28px] font-extrabold leading-9 tracking-tight">{t('{sender} got the email you gave only to {company}', vars)}</h1>
        </div>
        <ActionButton variant="danger" size="lg" onClick={async () => { const c = await act('complaint'); navigate(`/app/complaints/${c.id}`); }}>
          <Icon name="scale" />{t('Add to complaint')}
        </ActionButton>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Card className="gap-6 p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AiTag ai={inv?.ai} label={t('AI investigation: how {sender} got your email', vars)} />
              {inv && <Chip tone={inv.confidence === 'high' ? 'leak' : 'nr'}>{inv.confidence === 'high' ? t('High confidence') : inv.confidence === 'low' ? t('Low confidence') : t('Medium confidence')}</Chip>}
            </div>
            {inv ? <LeakChain chain={inv.chain} company={l.company} /> : <span className="text-sm text-mute">{t('The investigation has not run yet.')}</span>}
            {inv?.reasons?.length ? (
              <Well className="gap-2.5">
                <span className="text-sm font-bold">{t('Why {name}', { name: inv.likelySourceName })}</span>
                {inv.reasons.map((r, i) => <span key={i} className="flex items-start gap-2 text-sm text-ink2"><Icon name="check" size="sm" className="mt-0.5 text-ok" />{t(r)}</span>)}
              </Well>
            ) : null}
            <ActionButton variant="ghost" size="sm" className="self-start" onClick={async () => { await act('reinvestigate'); reload(); toast(t('Investigation updated')); }}>
              <Icon name="refresh" size="sm" />{t('Run the investigation again')}
            </ActionButton>
          </Card>

          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-line bg-soft px-5 py-4">
              <span className="font-bold">{t('The message we stopped')}</span>
              <Chip tone="leak" icon="ban">{t('Blocked')}</Chip>
            </div>
            <dl className="m-0 grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-line px-5 py-4 text-sm">
              <dt className="text-mute">{t('From')}</dt><dd className="m-0 font-semibold" translate="no">{l.senderName} &lt;{l.senderEmail}&gt;</dd>
              <dt className="text-mute">{t('To')}</dt><dd className="m-0 font-mono text-[13px]" translate="no">{l.address?.email}</dd>
              <dt className="text-mute">{t('Subject')}</dt><dd className="m-0 font-semibold">{l.subject}</dd>
            </dl>
            <p className="m-0 whitespace-pre-wrap px-5 py-4 text-sm text-ink2">{l.excerpt}</p>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="gap-1">
            <h2 className="pb-2 text-lg font-bold">{t('What to do')}</h2>
            <Step icon="check" tone="ok" title={t('Blocked {sender} only', vars)} sub={t("{company}'s emails still reach you", vars)} />
            <Step icon="trash" title={t('Ask {sender} to delete it', vars)} sub={t('AI-written, signed by you')}>
              {l.actions?.requestId
                ? <ButtonLink to="/app/delete" variant="secondary" size="sm">{t('Draft ready')}</ButtonLink>
                : <ActionButton variant="secondary" size="sm" onClick={async () => { await act('request-deletion'); toast(t('Draft request created. Review it on Delete my data.')); navigate('/app/delete'); }}>{t('Ask')}</ActionButton>}
            </Step>
            <Step icon="refresh" title={t('Give {company} a new address', vars)} sub={l.actions?.rotated ? t('Now {email}', { email: l.actions.newAddress || '' }) : t('The old one stops working')}>
              {!l.actions?.rotated && <ActionButton variant="secondary" size="sm" onClick={async () => { const r = await act('rotate'); toast(t('New address {email}', { email: r.address?.email || '' })); reload(); }}>{t('Rotate')}</ActionButton>}
            </Step>
            <Step icon="file" title={t('Save the evidence')} sub={t('Timestamped and fingerprinted')}>
              {l.packId
                ? <ButtonLink to={`/app/evidence/${l.packId}`} variant="secondary" size="sm">{t('Open')}</ButtonLink>
                : <ActionButton variant="secondary" size="sm" onClick={async () => { const p = await act('evidence'); navigate(`/app/evidence/${p.id}`); }}>{t('Build')}</ActionButton>}
            </Step>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">{t('Who may use this address')}</h2>
            <div className="flex flex-col">
              {(l.address?.allowed || []).map(d => (
                <div key={d} className="flex min-h-11 items-center gap-3 border-b border-line last:border-b-0">
                  <Icon name="check" className="text-ok" /><span className="flex-1 text-sm" translate="no">{d}</span><Chip tone="ok">{t('Allowed')}</Chip>
                </div>
              ))}
              {(l.address?.blockedSenders || []).map(d => (
                <div key={d} className="flex min-h-11 items-center gap-3 border-b border-line last:border-b-0">
                  <Icon name="ban" className="text-leak" /><span className="flex-1 text-sm" translate="no">{d}</span><Chip tone="leak">{t('Blocked')}</Chip>
                </div>
              ))}
            </div>
            <Link to="/app/protect" className="text-sm font-semibold">{t('Manage protected addresses')}</Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Step({ icon, tone = 'brand', title, sub, children }: { icon: 'check' | 'trash' | 'refresh' | 'file'; tone?: 'brand' | 'ok'; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 border-b border-line py-2 last:border-b-0">
      <Tile icon={icon} tone={tone} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold">{title}</span><span className="text-[13px] text-mute">{sub}</span></span>
      {children}
    </div>
  );
}
