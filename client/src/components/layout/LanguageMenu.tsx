import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { LANGUAGES, languageByCode } from '@/i18n/languages';
import { useI18n } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/format';

/** Globe button that switches the whole app's language. */
export function LanguageMenu({ dark, showLabel }: { dark?: boolean; showLabel?: boolean }) {
  const { lang, t } = useI18n();
  const { setLanguage } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t('Language')}
        className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 font-semibold',
          dark ? 'text-on/90 hover:bg-white/10' : 'border border-line bg-card text-ink2 hover:bg-soft', !showLabel && 'w-11 px-0')}>
        <Icon name="globe" />{showLabel && <span translate="no">{languageByCode(lang).native}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 grid w-64 animate-fade grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-2 shadow-pop">
          {LANGUAGES.map(l => (
            <button key={l.code} role="menuitemradio" aria-checked={l.code === lang} translate="no"
              onClick={() => { setLanguage(l.code); setOpen(false); }}
              className={cn('flex flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-soft', l.code === lang && 'bg-brand-s')}>
              <span className="text-sm font-semibold text-ink">{l.native}</span>
              <span className="text-xs text-mute">{l.english}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
