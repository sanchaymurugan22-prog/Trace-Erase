import { Link } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { ButtonLink, Logo } from '@/components/ui';
import { cn } from '@/lib/format';
import { LanguageMenu } from './LanguageMenu';

/** Top navigation on the public pages (landing, scores). */
export function PublicNav({ light }: { light?: boolean }) {
  const { user, staff } = useSession();
  const t = useT();
  const linkCls = cn('whitespace-nowrap text-[15px] font-semibold leading-8 opacity-85 hover:opacity-100', light ? 'text-ink hover:text-ink' : 'text-on hover:text-white');
  return (
    <header className="mx-auto flex h-[76px] w-full max-w-[1320px] items-center gap-8 px-10 max-[820px]:gap-4 max-[820px]:overflow-x-auto max-[820px]:px-4">
      <Link to="/welcome" aria-label="TraceErase" className="shrink-0"><Logo dark={!light} size={34} /></Link>
      {/* One fixed-height row: links that don't fit in a long language wrap onto a hidden second row instead of
          running into the buttons. They are all repeated in the footer. */}
      <nav className="ml-4 flex h-8 min-w-0 flex-1 flex-wrap items-center gap-x-6 overflow-hidden max-[1100px]:invisible" aria-label={t('Main')}>
        <a className={linkCls} href="/welcome#how">{t('How it works')}</a>
        <a className={linkCls} href="/welcome#ai">{t('AI features')}</a>
        <Link className={linkCls} to="/scores">{t('Company scores')}</Link>
        <Link className={linkCls} to="/verify">{t('Verify a receipt')}</Link>
      </nav>
      <div className="flex shrink-0 items-center gap-6 max-[820px]:gap-3">
        <LanguageMenu dark={!light} showLabel />
        {staff ? <ButtonLink to="/regulator" variant={light ? 'primary' : 'white'}>{t('Regulator console')}</ButtonLink>
          : user?.verified ? <ButtonLink to="/app" variant={light ? 'primary' : 'white'}>{t('Open dashboard')}</ButtonLink>
          : <>
              <ButtonLink to="/login" variant={light ? 'secondary' : 'outline'}>{t('Log in')}</ButtonLink>
              <ButtonLink to="/signup" variant={light ? 'primary' : 'white'}>{t('Get started')}</ButtonLink>
            </>}
      </div>
    </header>
  );
}
