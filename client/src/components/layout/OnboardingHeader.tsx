import { Fragment } from 'react';
import { Link } from '@/lib/router';
import { Icon, Logo } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { cn } from '@/lib/format';
import { LanguageMenu } from './LanguageMenu';

const STEPS = [['identity', 'Identity'], ['connect', 'Connect'], ['scan', 'Scan'], ['results', 'Results']] as const;

/** Header for the 4 onboarding steps, with progress. */
export function OnboardingHeader({ step, dark }: { step: typeof STEPS[number][0]; dark?: boolean }) {
  const t = useT();
  const idx = STEPS.findIndex(s => s[0] === step);
  return (
    <header className={cn('flex h-[76px] items-center gap-6 px-10 max-[820px]:px-4', dark ? 'border-b border-white/8' : 'border-b border-line bg-card')}>
      <Logo dark={!!dark} size={30} text={18} />
      <nav className="mx-auto flex items-center gap-2 max-[900px]:hidden" aria-label={t('Setup progress')}>
        {STEPS.map(([k, label], i) => (
          <Fragment key={k}>
            {i > 0 && <span className={cn('h-0.5 w-9', i <= idx ? 'bg-accent' : dark ? 'bg-white/12' : 'bg-line')} />}
            <span className={cn('flex items-center gap-2 text-sm font-semibold', i === idx ? (dark ? 'text-white' : 'text-ink') : dark ? 'text-onm' : 'text-mute')}>
              <span className={cn('inline-flex size-[26px] items-center justify-center rounded-full text-xs font-bold',
                i < idx ? 'bg-accent text-white' : i === idx ? (dark ? 'bg-white text-navy' : 'bg-brand text-white') : dark ? 'bg-white/10' : 'bg-soft2')}>
                {i < idx ? <Icon name="check" size="xs" /> : i + 1}
              </span>
              {t(label)}
            </span>
          </Fragment>
        ))}
      </nav>
      <LanguageMenu dark={dark} />
      <Link to="/app" className={cn('text-sm font-semibold', dark ? 'text-onm hover:text-white' : 'text-mute hover:text-ink')}>{t('Skip for now')}</Link>
    </header>
  );
}
