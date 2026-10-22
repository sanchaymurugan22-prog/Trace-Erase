/** Circular progress ring with content in the middle. */
export function Ring({ pct, size = 150, color = 'var(--color-brand)', children }: { pct: number; size?: number; color?: string; children?: React.ReactNode }) {
  const inner = size - 32;
  return (
    <div className="grid flex-none place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${color} 0 ${pct}%, var(--color-soft2) ${pct}% 100%)` }}>
      <div className="flex flex-col items-center justify-center rounded-full bg-card" style={{ width: inner, height: inner }}>{children}</div>
    </div>
  );
}

export function ProgressBar({ pct, color, dark, className }: { pct: number; color?: string; dark?: boolean; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${dark ? 'bg-white/12' : 'bg-soft2'} ${className || ''}`}>
      <span className="block h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color || 'var(--color-brand)' }} />
    </div>
  );
}
