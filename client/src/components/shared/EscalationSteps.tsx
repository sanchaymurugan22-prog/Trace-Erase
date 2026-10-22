import { useT } from '@/i18n/I18nProvider';
import { Icon, type IconName } from '@/components/ui';
import { cn } from '@/lib/format';
import type { DeletionRequest } from '@/types/api';

const ICON: Record<string, IconName> = { sent: 'send', reminder: 'bell', grievance: 'alert', complaint: 'scale', board: 'building' };

/** Sent → Reminder → Grievance → Complaint → Board, with today's position. */
export function EscalationSteps({ steps }: { steps: DeletionRequest['steps'] }) {
  const t = useT();
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
      {steps.map((s, i) => (
        <div key={s.key} className="relative flex flex-col gap-1.5 pr-2.5">
          {i < steps.length - 1 && <span className={cn('absolute left-[30px] right-0 top-3.5 h-0.5', s.state === 'done' ? 'bg-accent' : 'bg-line')} />}
          <span className={cn('relative z-[1] flex size-[30px] items-center justify-center rounded-full',
            s.state === 'done' ? 'bg-accent text-white' : s.state === 'current' ? 'bg-brand text-white ring-[5px] ring-brand/18' : 'bg-soft2 text-mute')}>
            <Icon name={s.state === 'done' ? 'check' : ICON[s.key] || 'dot'} size="sm" />
          </span>
          <span className="text-sm font-semibold">{t(s.label)}</span>
          <span className="text-[13px] text-mute">{s.day === null ? t('After filing') : s.state === 'current' ? t('Day {n} · today', { n: s.day }) : t('Day {n}', { n: s.day })}</span>
        </div>
      ))}
    </div>
  );
}
