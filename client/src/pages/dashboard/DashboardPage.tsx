// Dashboard: today's picture of the user's data.
import { Link } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDate, fmtDateLong } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { AiCard, AiTag, ButtonLink, Card, CardLink, Chip, DarkPanel, EmptyState, ErrorBox, Icon, PageLoading, ProgressBar, Ring, Tile, type IconName } from '@/components/ui';
import { EscalationSteps } from '@/components/shared/EscalationSteps';
import { TargetRow } from '@/components/shared/TargetRow';

const NEED_ICON: Record<string, [IconName, 'leak' | 'nr' | 'accent' | 'brand']> = { leak: ['siren', 'leak'], complaint: ['scale', 'nr'], switch: ['refresh', 'accent'], webform: ['globe', 'brand'] };

export default function DashboardPage() {
  const { user } = useSession();
  const t = useT();
  const { data: d, error, loading, reload } = useApi<any>('/dashboard', { interval: 15000 });
  if (loading) return <AppShell><PageLoading /></AppShell>;
  if (error || !d) return <AppShell><ErrorBox error={error} retry={reload} /></AppShell>;

  const hour = new Date(d.today).getHours();
  const greet = hour < 12 ? 'Good morning, {name}' : hour < 17 ? 'Good afternoon, {name}' : 'Good evening, {name}';
  const r = d.request;
  const maxCat = Math.max(1, ...d.categories.map((c: any) => c.count));
  const kpis: { to: string; label: string; icon: IconName; tone?: 'ok' | 'leak'; value: number; foot: React.ReactNode }[] = [
    { to: '/app/companies', label: 'Companies with your data', icon: 'building', value: d.kpis.companies, foot: <span><b className="text-ok">+{d.kpis.newThisMonth}</b> {t('found this month')}</span> },
    { to: '/app/requests', label: 'Being deleted', icon: 'trash', value: d.kpis.beingDeleted, foot: <ProgressBar pct={r ? (100 * r.resolved) / Math.max(1, r.total) : 0} /> },
    { to: '/app/evidence', label: 'Deleted, with proof', icon: 'check', tone: 'ok', value: d.kpis.verified, foot: t('Signed receipts') },
    { to: '/app/alerts', label: 'Leaks caught', icon: 'siren', tone: 'leak', value: d.kpis.leaks, foot: t(d.kpis.leaks ? 'Sender blocked' : 'None so far') }
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-mute">{fmtDateLong(d.today)}</span>
          <h1 className="text-4xl font-extrabold tracking-tight">{t(greet, { name: user?.name.split(' ')[0] })}</h1>
        </div>
        <span className="flex items-center gap-2 text-sm text-mute"><Icon name="shieldc" className="text-accent" />{t('Watching {n} protected emails and 1 number', { n: d.watching.addresses })}</span>
      </div>

      {d.leak && (
        <Card className="flex-row flex-wrap items-center gap-5 border-[#F6C4BF] bg-leak-s px-6 py-5">
          <Tile icon="siren" tone="leak" size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xl font-bold">{t('Leak caught: {sender} emailed your {company}-only address', { sender: d.leak.sender, company: d.leak.company })}</span>
            {d.leak.source && <span className="flex items-center gap-1.5 text-sm text-ink2"><AiTag /> {t('traced it to {name}.', { name: d.leak.source })}</span>}
          </div>
          <ButtonLink to={`/app/leaks/${d.leak.id}`} variant="danger">{t('Investigate')}</ButtonLink>
        </Card>
      )}

      {!d.kpis.companies && (
        <DarkPanel className="gap-3.5 p-8">
          <h2 className="text-[28px] font-bold text-white">{t("Let's find out who has your data")}</h2>
          <p className="text-onm">{t('Run the AI scan on your inbox to list every company holding your data.')}</p>
          <ButtonLink to="/onboarding/connect" variant="white" className="self-start"><Icon name="sparkle" />{t('Start the scan')}</ButtonLink>
        </DarkPanel>
      )}

      <div className="grid grid-cols-4 gap-5 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
        {kpis.map(k => (
          <CardLink key={k.to} to={k.to} className="gap-1.5">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-mute">{t(k.label)}</span><Tile icon={k.icon} tone={k.tone || 'brand'} size="sm" /></div>
            <span className={`font-display text-4xl font-extrabold tracking-tight ${k.tone === 'ok' ? 'text-ok' : k.tone === 'leak' ? 'text-leak' : ''}`}>{k.value}</span>
            <span className="text-[13px] text-mute">{k.foot}</span>
          </CardLink>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-6">
          {r ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5"><span className="text-[13px] text-mute">{t('Request {number} · sent {date}', { number: r.number, date: fmtDate(r.signedAt) })}</span><h2 className="text-xl font-bold">{t('Deleting from {n} companies', { n: r.total })}</h2></div>
                <ButtonLink to={`/app/requests/${r.id}`} variant="secondary" size="sm">{t('Open request')}<Icon name="ar" size="sm" /></ButtonLink>
              </div>
              <EscalationSteps steps={r.steps.slice(0, 4)} />
              <div className="flex flex-col">{r.targets.map((tg: any) => <TargetRow key={tg.id} requestId={r.id} target={tg} />)}</div>
            </Card>
          ) : d.kpis.companies ? (
            <Card><EmptyState icon="trash" title="No deletion request yet" action={<ButtonLink to="/app/delete">{t('Choose what to delete')}</ButtonLink>}>{t('Pick the companies you want to forget you. We also ask every partner they name in their reply.')}</EmptyState></Card>
          ) : null}
          {d.categories.length > 0 && (
            <Card>
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{t('Where your data lives')}</h2><Link to="/app/map" className="text-sm font-semibold">{t('Open data map')}</Link></div>
              <div className="flex flex-col gap-3">
                {d.categories.slice(0, 6).map((c: any) => (
                  <div key={c.name} className="grid grid-cols-[110px_minmax(0,1fr)_32px] items-center gap-3 text-sm"><span className="text-ink2">{t(c.name)}</span><ProgressBar pct={(100 * c.count) / maxCat} className="h-3" /><span className="font-bold">{c.count}</span></div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-xl font-bold">{t('Privacy score')}</h2>
            <div className="flex items-center gap-5">
              <Ring pct={d.score.score} size={148}><span className="font-display text-[40px] font-extrabold leading-[44px]">{d.score.score}</span><span className="text-[13px] text-mute">{t('out of 100')}</span></Ring>
              <div className="flex flex-col gap-2">
                <Chip tone={d.score.score >= 80 ? 'ok' : d.score.score >= 60 ? 'part' : 'nr'} className="self-start">{t(d.score.label)}</Chip>
                <span className="text-sm text-mute">{t('Based on unused accounts, real emails in use, leaks and ignored requests.')}</span>
              </div>
            </div>
            {d.score.tips.length > 0 && (
              <div className="flex flex-col">
                {d.score.tips.map((tip: any) => <Link key={tip.text} to={tip.to} className="flex items-center gap-3 border-b border-line py-3 text-ink last:border-b-0 hover:text-ink"><span className="flex-1 text-sm">{t(tip.text)}</span><Chip tone="ok">+{tip.points}</Chip></Link>)}
              </div>
            )}
          </Card>
          <Card>
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{t('Needs you')}</h2>{d.needs.length > 0 && <Chip tone="leak">{d.needs.length}</Chip>}</div>
            {d.needs.length ? (
              <div className="flex flex-col">
                {d.needs.map((n: any, i: number) => {
                  const [icon, tone] = NEED_ICON[n.type] || ['bell', 'brand'];
                  return (
                    <Link key={i} to={n.link || '/app/alerts'} className="flex items-center gap-3 border-b border-line py-3 text-ink last:border-b-0 hover:text-ink">
                      <Tile icon={icon} tone={tone} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold">{t(n.title)}</span><span className="clamp-2 text-[13px] text-mute">{t(n.body)}</span></span>
                    </Link>
                  );
                })}
              </div>
            ) : <span className="text-sm text-mute">{t('Nothing needs you right now.')}</span>}
          </Card>
          <AiCard>
            <AiTag ai={d.summary.ai} label="Today's summary" />
            <p className="text-sm text-ink2">{t(d.summary.text)}</p>
            <ButtonLink to="/app/assistant" variant="secondary" size="sm" className="self-start">{t('Ask TraceErase')}</ButtonLink>
          </AiCard>
        </div>
      </div>
    </AppShell>
  );
}
