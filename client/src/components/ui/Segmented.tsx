import { cn } from '@/lib/format';

/** Pill-shaped segmented control. */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-soft p-1', className)} role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3.5 text-sm font-semibold transition', value === o.value ? 'bg-card text-ink shadow-card' : 'text-mute hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Underlined tabs. */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="flex gap-7 overflow-x-auto border-b border-line" role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('-mb-px whitespace-nowrap border-b-2 py-3 text-[15px] font-semibold', value === o.value ? 'border-brand text-ink' : 'border-transparent text-mute hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
