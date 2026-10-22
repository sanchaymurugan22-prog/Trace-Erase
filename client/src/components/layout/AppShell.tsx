import { useEffect, useState } from 'react';
import { Link, useNavigate, useRouter } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { get } from '@/lib/api';
import { cn, initials } from '@/lib/format';
import { Icon, LogoMark, Wordmark, ButtonLink, type IconName } from '@/components/ui';
import { DemoPanel } from '@/components/demo/DemoPanel';
import { LanguageMenu } from './LanguageMenu';

type NavItem = { section: string } | { to: string; icon: IconName; label: string; count?: 'companies' | 'alerts' };
const NAV: NavItem[] = [
  { section: 'Overview' },
  { to: '/app', icon: 'grid', label: 'Dashboard' },
  { to: '/app/map', icon: 'map', label: 'Data map' },
  { to: '/app/companies', icon: 'building', label: 'Companies', count: 'companies' },
  { to: '/app/alerts', icon: 'bell', label: 'Alerts', count: 'alerts' },
  { section: 'Take action' },
  { to: '/app/requests', icon: 'trash', label: 'Deletion requests' },
  { to: '/app/protect', icon: 'plus', label: 'Protect a sign-up' },
  { to: '/app/evidence', icon: 'file', label: 'Evidence and proof' },
  { to: '/app/assistant', icon: 'sparkle', label: 'Ask TraceErase' },
  { to: '/app/activity', icon: 'inbox', label: 'Activity log' },
  { to: '/app/settings', icon: 'settings', label: 'Settings' }
];

function useCounts() {
  const [c, setC] = useState({ companies: 0, alerts: 0 });
  const { path } = useRouter();
  useEffect(() => {
    let alive = true;
    const load = () => Promise.all([get<any[]>('/companies').catch(() => []), get<any[]>('/alerts').catch(() => [])])
      .then(([cs, as]) => { if (alive) setC({ companies: cs.length, alerts: as.filter(a => !a.read).length }); });
    load();
    window.addEventListener('te:refresh', load);
    return () => { alive = false; window.removeEventListener('te:refresh', load); };
  }, [path]);
  return c;
}

/** The signed-in layout: navy sidebar, top bar, page content. */
export function AppShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const { user, flags } = useSession();
  const { path } = useRouter();
  const navigate = useNavigate();
  const t = useT();
  const counts = useCounts();
  const [q, setQ] = useState('');
  const links = NAV.filter((n): n is Extract<NavItem, { to: string }> => 'to' in n);
  const current = active || links.map(n => n.to).filter(p => p === path || (p !== '/app' && path.startsWith(p))).sort((a, b) => b.length - a.length)[0] || '/app';

  return (
    <div className="flex min-h-screen bg-bg max-[820px]:flex-col">
      <aside className="sticky top-0 flex h-screen w-[272px] flex-none flex-col gap-1 overflow-y-auto bg-navy px-4 py-6 text-on max-[820px]:static max-[820px]:h-auto max-[820px]:w-auto">
        <Link to="/app" className="flex items-center gap-2.5 px-2 pb-6 text-white" aria-label="TraceErase"><LogoMark size={32} /><Wordmark /></Link>
        <nav className="flex flex-col gap-0.5" aria-label={t('Main')}>
          {NAV.map((n, i) => 'section' in n
            ? <span key={i} className="px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[.1em] text-[#7F8DA8]">{t(n.section)}</span>
            : (
              <Link key={n.to} to={n.to} aria-current={current === n.to ? 'page' : undefined}
                className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-semibold',
                  current === n.to ? 'bg-white/10 text-white [&>svg]:text-accent-b' : 'text-onm hover:bg-white/5 hover:text-white')}>
                <Icon name={n.icon} />{t(n.label)}
                {n.count === 'companies' && counts.companies > 0 && <span className="ml-auto rounded-full bg-white/12 px-2 text-xs font-bold leading-[22px] text-white">{counts.companies}</span>}
                {n.count === 'alerts' && counts.alerts > 0 && <span className="ml-auto rounded-full bg-[#E5484D] px-2 text-xs font-bold leading-[22px] text-white">{counts.alerts}</span>}
              </Link>
            ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2.5 rounded-2xl border border-white/7 bg-navy2 p-4 max-[820px]:hidden">
          <span className="text-[13px] text-onm">{t('Protected number')}</span>
          {user?.protectedNumber
            ? <><span className="font-mono text-[15px] text-white" translate="no">{user.protectedNumber}</span><span className="text-[13px] text-onm">{t('Calls and SMS from apps you use ring through')}</span></>
            : <span className="text-[13px] text-onm">{t('Not available yet: phone protection needs a paid phone service. Try it in the demo.')}</span>}
          {flags?.protectedEmail !== false && <ButtonLink to="/app/protect" variant="outline" size="sm" full><Icon name="plus" size="sm" />{t('New protected email')}</ButtonLink>}
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] flex-none items-center gap-4 border-b border-line bg-card px-8 max-[820px]:px-4">
          <form role="search" className="flex h-11 max-w-[480px] flex-1 items-center gap-2.5 rounded-xl bg-soft px-3.5 text-mute"
            onSubmit={e => { e.preventDefault(); navigate(`/app/companies?q=${encodeURIComponent(q)}`); }}>
            <Icon name="search" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search companies')} aria-label={t('Search companies')}
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
          </form>
          <span className="flex-1" />
          <ButtonLink to="/app/delete"><Icon name="trash" />{t('Delete my data')}</ButtonLink>
          <LanguageMenu />
          <Link to="/app/alerts" aria-label={t('Alerts')} className="relative inline-flex size-11 items-center justify-center rounded-xl border border-line bg-card text-ink2 hover:bg-soft">
            <Icon name="bell" />{counts.alerts > 0 && <span className="absolute right-[11px] top-2.5 size-2 rounded-full border-2 border-white bg-[#E5484D]" />}
          </Link>
          <Link to="/app/settings" aria-label={t('Account')} className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-brand font-display text-sm font-bold text-white hover:text-white" translate="no">{initials(user?.name)}</Link>
        </header>
        {user?.demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#FFF4D6] px-4 py-2 text-center text-[13px] text-[#6B4E00]" role="status">
            <Icon name="play" size="sm" /><b>{t('Demo account')}</b><span>{t('Sample data only. Nothing is sent to real companies, and this account is removed after 3 days.')}</span>
            <Link to="/signup" className="font-semibold text-[#6B4E00] underline">{t('Create a real account')}</Link>
          </div>
        )}
        <main key={path} className="mx-auto flex w-full max-w-[1280px] animate-fade flex-col gap-6 p-8 max-[820px]:px-4 max-[820px]:py-5">{children}</main>
      </div>
      {flags?.demoMode && user?.demo && <DemoPanel />}
    </div>
  );
}
