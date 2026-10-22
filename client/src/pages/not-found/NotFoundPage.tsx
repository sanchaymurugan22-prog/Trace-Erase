import { useT } from '@/i18n/I18nProvider';
import { ButtonLink, LogoMark } from '@/components/ui';

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4 text-center">
        <LogoMark size={56} dark={false} />
        <h1 className="text-4xl font-extrabold">{t('Page not found')}</h1>
        <ButtonLink to="/welcome">{t('Go home')}</ButtonLink>
      </div>
    </div>
  );
}
