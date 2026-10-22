import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { Logo } from '@/components/ui';

export function Footer() {
  const t = useT();
  return (
    <footer className="bg-navy px-10 py-10 text-on max-[820px]:px-4">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4">
        <Logo />
        <div className="flex flex-wrap items-center gap-6 text-[13px]">
          <Link to="/scores" className="text-onm hover:text-white">{t('Company scores')}</Link>
          <Link to="/verify" className="text-onm hover:text-white">{t('Verify a receipt')}</Link>
          <Link to="/regulator/login" className="text-onm hover:text-white">{t('Regulator login')}</Link>
          <span className="text-onm">© 2026 TraceErase · Team Cranial Remission · DEXATHON 2026</span>
        </div>
      </div>
    </footer>
  );
}
