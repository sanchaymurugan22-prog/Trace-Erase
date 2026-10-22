import { cn } from '@/lib/format';
import { Icon, type IconName } from './Icon';

export type Tone = 'ok' | 'part' | 'clm' | 'pend' | 'nr' | 'ovd' | 'leak' | 'accent' | 'brand' | 'neutral' | 'dark';

const TONES: Record<Tone, string> = {
  ok: 'bg-ok-s text-ok', part: 'bg-part-s text-part', clm: 'bg-clm-s text-clm', pend: 'bg-pend-s text-pend',
  nr: 'bg-nr-s text-nr', ovd: 'bg-ovd-s text-ovd', leak: 'bg-leak-s text-leak', accent: 'bg-accent-s text-accent',
  brand: 'bg-brand-s text-brand', neutral: 'bg-soft text-ink2', dark: 'bg-white/10 text-on'
};

export function Chip({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: IconName; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold leading-4', TONES[tone], className)}>
      {icon && <Icon name={icon} size="xs" />}{children}
    </span>
  );
}
