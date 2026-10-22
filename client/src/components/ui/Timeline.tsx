import { cn } from '@/lib/format';
import { Icon, type IconName } from './Icon';

export interface TimelineItem { icon: IconName; state?: 'done' | 'current' | 'warn' | 'todo'; title: React.ReactNode; sub?: React.ReactNode }

const DOT = { done: 'bg-accent-s text-accent', current: 'bg-brand text-white', warn: 'bg-leak-s text-leak', todo: 'bg-soft2 text-mute' };

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((it, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex w-8 flex-none flex-col items-center">
            <span className={cn('inline-flex size-8 flex-none items-center justify-center rounded-full', DOT[it.state || 'done'])}><Icon name={it.icon} size="sm" /></span>
            {i < items.length - 1 && <span className="my-1 min-h-5 w-0.5 flex-1 bg-line" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pb-5">{it.title}{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

/** Horizontal numbered steps (1 — 2 — 3). */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2.5">
          {i > 0 && <span className={cn('h-0.5 w-6', i <= current ? 'bg-accent' : 'bg-line')} />}
          <span className={cn('inline-flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-bold',
            i < current ? 'bg-accent text-white' : i === current ? 'bg-brand text-white ring-4 ring-brand/20' : 'bg-soft2 text-mute')}>
            {i < current ? <Icon name="check" size="xs" /> : i + 1}
          </span>
          <span className={cn('text-sm font-semibold', i === current ? 'text-ink' : 'text-mute')}>{s}</span>
        </div>
      ))}
    </div>
  );
}
