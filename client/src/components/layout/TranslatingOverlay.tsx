import { languageByCode } from '@/i18n/languages';
import { useI18n } from '@/i18n/I18nProvider';
import { Spinner } from '@/components/ui';

/** Small notice while a language's dictionary loads (usually a fraction of a second). */
export function TranslatingOverlay() {
  const { lang } = useI18n();
  return (
    <div className="fixed left-1/2 top-5 z-[120] flex -translate-x-1/2 animate-fade items-center gap-2.5 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-modal" role="status">
      <Spinner className="text-accent-b" /><span translate="no">{languageByCode(lang).native}</span>
    </div>
  );
}
