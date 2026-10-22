import { useRef } from 'react';
import { cn } from '@/lib/format';

/** Six boxes for a one-time code; supports paste. */
export function OtpInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = (value + '      ').slice(0, 6).split('');
  const set = (i: number, d: string) => {
    const arr = digits.slice();
    arr[i] = d || ' ';
    onChange(arr.join('').replace(/\s+$/, ''));
  };
  return (
    <div className="flex gap-2.5" role="group" aria-label={label} dir="ltr">
      {digits.map((d, i) => (
        <input key={i} ref={el => { refs.current[i] = el; }} inputMode="numeric" autoFocus={autoFocus && i === 0} aria-label={`${label} ${i + 1}`}
          value={d.trim()} maxLength={6}
          className={cn('h-16 w-14 rounded-2xl border-[1.5px] bg-card text-center font-display text-2xl font-bold text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/15', d.trim() ? 'border-brand' : 'border-line2')}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) { onChange(v.slice(0, 6)); refs.current[Math.min(5, v.length)]?.focus(); return; }
            set(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={e => { if (e.key === 'Backspace' && !d.trim() && i > 0) refs.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}
