// Company detail: what one company holds, who it shared with, and its history.
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { agoParts, copyText, fmtDateTime, shortHash } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, Button, ButtonLink, Card, CardLink, Chip, CompanyAvatar, ErrorBox, Icon, PageLoading, StatusChip, Timeline, useToast } from '@/components/ui';
import { PolicyCard } from './PolicyCard';

export default function CompanyDetailPage({ params }: { params: Record<string, string> }) {
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const { data: c, loading, error, reload } = useApi<any>('/companies/' + params.id);
  if (loading) return <AppShell active="/app/companies"><PageLoading /></AppShell>;
  if (error || !c) return <AppShell active="/app/companies"><ErrorBox error={error} /></AppShell>;
  const [tpl, n] = agoParts(c.lastSeen);
  const name = c.company.name;

  return (
    <AppShell active="/app/companies">
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb"><Link to="/app/companies" className="font-semibold">{t('Companies')}</Link><Icon name="cr" size="sm" className="text-mute" /><span className="text-mute" translate="no">{name}</span></nav>

      <Card className="gap-5 p-7">
        <div className="flex flex-wrap items-center gap-5">
          <CompanyAvatar company={c.company} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl font-extrabold tracking-tight" translate="no">{name}</h1><StatusChip status={c.status} /></div>
            <span className="text-mute">{t(c.company.category)} · {c.company.domain}{c.via ? ` · ${t('got your data from {name}', { name: c.via.name })}` : ''}{c.lastSeen ? ` · ${t('last seen {when}', { when: t(tpl, { n }).toLowerCase() })}` : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/app/assistant?q=${encodeURIComponent(`What does ${name} keep about me?`)}`} variant="secondary"><Icon name="sparkle" />{t('Ask about {name}', { name })}</ButtonLink>
            {!c.via && !c.usingProtected && <ButtonLink to={`/app/companies/${c.id}/fix`} variant="secondary"><Icon name="refresh" />{t('Fix old account')}</ButtonLink>}
            <Button onClick={() => navigate('/app/delete?ids=' + c.id)}><Icon name="trash" />{t('Delete my data')}</Button>
          </div>
        </div>
        {c.address ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-soft px-4 py-3">
            <Icon name="mail" className="text-accent" /><span className="text-sm text-mute">{t('Protected email for {name}', { name })}</span>
            <span className="font-mono text-sm font-bold" translate="no">{c.address.email}</span>
            <Button variant="ghost" size="sm" onClick={() => copyText(c.address.email, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button>
            <span className="flex-1" />
            {c.address.leaks > 0 && <Chip tone="leak" icon="siren">{t('{n} leaks on this address', { n: c.address.leaks })}</Chip>}
          </div>
        ) : !c.via && (
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-nr-s px-4 py-3">
            <Icon name="alert" className="text-nr" /><span className="flex-1 text-sm">{t('{name} still has your real email.', { name })}</span>
            <ButtonLink to={`/app/companies/${c.id}/fix`} variant="secondary" size="sm">{t('Switch to a protected email')}</ButtonLink>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-6">
          {c.target?.result && (
            <Card>
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{t('Deletion result')}</h2>{c.deletionReceipt && <Link to={`/app/receipts/${c.deletionReceipt.id}`} className="text-sm font-semibold">{t('Signed receipt')}</Link>}</div>
              <div className="flex flex-col gap-2">
                {(c.target.result.deleted || []).map((x: string) => <span key={x} className="flex items-center gap-2 text-sm"><Icon name="check" size="sm" className="text-ok" />{t('Deleted')}: {t(x)}</span>)}
                {(c.target.result.kept || []).map((k: any) => <span key={k.field} className="flex items-center gap-2 text-sm"><Icon name="half" size="sm" className="text-part" />{t('Kept')}: {t(k.field)} ({t(k.law)})</span>)}
              </div>
            </Card>
          )}
          <Card>
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{t('Shared with')}</h2><Link to="/app/map" className="text-sm font-semibold">{t('See on data map')}</Link></div>
            {c.partners.length ? (
              <div className="grid grid-cols-2 gap-3.5 max-[700px]:grid-cols-1">
                {c.partners.map((pt: any) => (
                  <Link key={pt.receiptId} to={`/app/receipts/${pt.receiptId}`} className={`flex flex-col gap-2.5 rounded-2xl border bg-card p-4 text-ink hover:text-ink ${['overdue', 'no-response'].includes(pt.status) ? 'border-[#F6C4BF]' : 'border-line'}`}>
                    <div className="flex items-center gap-3"><CompanyAvatar company={pt.company} size="sm" /><span className="flex min-w-0 flex-1 flex-col"><span className="font-bold" translate="no">{pt.company.name}</span><span className="text-[13px] text-mute">{t(pt.purpose)} · {(pt.fields || []).map((f: string) => t(f)).join(', ')}</span></span></div>
                    <div className="flex items-center justify-between"><span className="font-mono text-xs text-mute">{shortHash(pt.hash)}</span><StatusChip status={pt.status} short /></div>
                  </Link>
                ))}
              </div>
            ) : <span className="text-sm text-mute">{t("{name} hasn't named its partners to you yet. When you ask it to delete, AI reads its reply and lists every partner it names here. Until then, this is what its policy says (on the right).", { name })}</span>}
          </Card>
          <Card>
            <h2 className="text-xl font-bold">{t('History')}</h2>
            <Timeline items={c.history.map((h: any, i: number) => ({
              icon: h.icon, state: i === c.history.length - 1 ? 'current' : 'done',
              title: <span className="font-semibold">{t(h.text)}</span>,
              sub: <span className="text-[13px] text-mute">{fmtDateTime(h.at)}{h.sub ? ` · ${t(h.sub)}` : ''}{h.receiptId && <> · <Link to={`/app/receipts/${h.receiptId}`}>{t('receipt')}</Link></>}</span>
            }))} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <PolicyCard companyId={c.id} policy={c.policy} onRefreshed={reload} />
          {c.score && (
            <CardLink to="/scores">
              <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Public score')} {c.score.sample ? `(${t('sample')})` : ''}</span>
              <div className="flex items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-ok-s font-display text-[26px] font-extrabold text-ok">{c.score.grade}</span>
                <span className="flex flex-col"><span className="text-[17px] font-bold">{t('{n}% deleted on time', { n: c.score.onTime })}</span><span className="text-[13px] text-mute">{t('Leaks traced: {n}', { n: c.score.leaks })}</span></span>
              </div>
            </CardLink>
          )}
          {c.address && (
            <Card>
              <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Allowed to email this address')}</span>
              <div className="flex flex-col">
                {c.allowed.map((d: string) => <div key={d} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"><Icon name="check" className="text-ok" /><span className="flex-1 text-sm" translate="no">{d}</span><Chip tone="ok">{t('Allowed')}</Chip></div>)}
                {c.blockedSenders.map((d: string) => <div key={d} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"><Icon name="ban" className="text-leak" /><span className="flex-1 text-sm" translate="no">{d}</span><Chip tone="leak">{t('Blocked')}</Chip></div>)}
              </div>
              <ActionButton variant="secondary" onClick={async () => { const a = await post(`/identity/addresses/${c.address.id}/rotate`); toast(t('New address: {email}', { email: a.email })); await reload(); }}><Icon name="refresh" />{t('Rotate this address')}</ActionButton>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
