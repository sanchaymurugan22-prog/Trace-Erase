import { Fragment } from 'react';
import { Icon } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { cn } from '@/lib/format';

const ITEMS = ['Create account', 'Verify email and phone', 'Create your passkey'];

/** Vertical progress shown on the navy side of the sign-up screens. */
export function SignupSteps({ at }: { at: 1 | 2 | 3 }) {
  const t = useT();
  return (
    <div className="flex flex-col">
      {ITEMS.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span className="ml-[19px] h-7 w-0.5 bg-white/15" />}
          <div className="flex items-start gap-4">
            <span className={cn('flex size-10 flex-none items-center justify-center rounded-full border-[1.5px] border-white/20 font-bold',
              i + 1 < at ? 'bg-accent-b text-navy' : i + 1 === at ? 'bg-white text-navy' : 'text-onm')}>
              {i + 1 < at ? <Icon name="check" size="sm" /> : i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={cn('font-bold', i + 1 <= at ? 'text-white' : 'text-onm')}>{t(label)}</span>
              <span className="text-[13px] text-onm">{t(i + 1 < at ? 'Done' : i + 1 === at ? 'You are here' : 'Next')}</span>
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
