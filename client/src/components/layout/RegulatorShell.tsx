import { Link, useNavigate, useRouter } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { cn } from '@/lib/format';
import { Icon, LogoMark, Wordmark, Button, type IconName } from '@/components/ui';
import { LanguageMenu } from './LanguageMenu';

const NAV: { to: string; icon: IconName; label: string }[] = [
  { to: '/regulator', icon: 'grid', label: 'Complaints overview' },
  { to: '/scores', icon: 'chart', label: 'Public company scores' },
  { to: '/verify', icon: 'shieldc', label: 'Verify a receipt' }
];

/** Layout for the regulator console (Data Protection Board officers). */
export function RegulatorShell({ children }: { children: React.ReactNode }) {
  const { staff, logoutStaff } = useSession();
  const { path } = useRouter();
  const navigate = useNavigate();
  const t = useT();
  return (
    <div className="flex min-h-screen bg-bg max-[820px]:flex-col">
      <aside className="sticky top-0 flex h-screen w-[272px] flex-none flex-col gap-1 bg-navy px-4 py-6 text-on max-[820px]:static max-[820px]:h-auto max-[820px]:w-auto">
        <Link to="/regulator" className="flex items-center gap-2.5 px-2 pb-6 text-white"><LogoMark size={32} /><Wordmark /></Link>
        <span className="px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[.1em] text-[#7F8DA8]">{t('Regulator console')}</span>
        {NAV.map(n => (
          <Link key={n.to} to={n.to} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-semibold', path === n.to ? 'bg-white/10 text-white [&>svg]:text-accent-b' : 'text-onm hover:bg-white/5 hover:text-white')}>
            <Icon name={n.icon} />{t(n.label)}
          </Link>
        ))}
        <div className="mt-auto flex flex-col gap-2 rounded-2xl border border-white/7 bg-navy2 p-4">
          <span className="text-[13px] text-onm">{t('Signed in as')}</span>
          <span className="truncate text-sm font-semibold text-white" translate="no">{staff?.email}</span>
          <span className="text-[13px] text-onm">{t(staff?.org || 'Data Protection Board (demo)')}</span>
          <Button variant="outline" size="sm" full onClick={async () => { await logoutStaff(); navigate('/welcome'); }}><Icon name="logout" size="sm" />{t('Log out')}</Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] items-center gap-4 border-b border-line bg-card px-8">
          <span className="font-display text-lg font-bold">{t('Data Protection Board')}</span>
          <span className="rounded-full bg-part-s px-2.5 py-1 text-xs font-bold text-part">{t('Prototype')}</span>
          <span className="flex-1" />
          <LanguageMenu />
        </header>
        <main className="mx-auto flex w-full max-w-[1280px] animate-fade flex-col gap-6 p-8">{children}</main>
      </div>
    </div>
  );
}
