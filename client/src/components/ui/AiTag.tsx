import { Icon } from './Icon';
import { useT } from '@/i18n/I18nProvider';

/** Shows whether a result came from Gemini or from the built-in rules. */
export function AiTag({ ai, label = 'AI' }: { ai?: boolean; label?: string }) {
  const t = useT();
  if (ai === false) {
    return <span className="inline-flex items-center gap-1 text-[13px] text-mute" title={t('Gemini was not available, so built-in rules were used')}><Icon name="settings" size="sm" />{t('Rules')}</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-[13px] font-bold leading-4 text-accent"><Icon name="sparkle" size="sm" />{t(label)}</span>;
}
