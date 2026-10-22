// TraceErase logo: a shield whose right edge dissolves into pixels (data being erased), with a check.
export function LogoMark({ size = 32, dark = true }: { size?: number; dark?: boolean }) {
  const s = dark ? '#FFFFFF' : '#0A1630';
  const tick = dark ? '#2DD4BF' : '#0B7A6E';
  const px = dark ? '#2DD4BF' : '#0B8F80';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="flex-none">
      <path d="M32 8L13 15v16c0 11.5 8 19.5 19 24.5" fill="none" stroke={s} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 8l19 7v9" fill="none" stroke={s} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="48.4" y="28.9" width="5.2" height="5.2" rx="1.2" fill={px} />
      <rect x="46.8" y="38.2" width="4.4" height="4.4" rx="1" fill={px} opacity=".8" />
      <rect x="41.6" y="46.2" width="3.6" height="3.6" rx=".9" fill={px} opacity=".6" />
      <rect x="35.3" y="51.6" width="2.8" height="2.8" rx=".7" fill={px} opacity=".42" />
      <path d="M23 31.5l6.5 6.5 12-12" fill="none" stroke={tick} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ dark = true, size = 20 }: { dark?: boolean; size?: number }) {
  return (
    <span className="whitespace-nowrap font-display font-extrabold tracking-tight" style={{ fontSize: size, lineHeight: 1, color: dark ? '#fff' : 'var(--color-ink)' }} translate="no">
      Trace<span style={{ color: dark ? '#2DD4BF' : 'var(--color-accent)' }}>Erase</span>
    </span>
  );
}

export function Logo({ dark = true, size = 32, text = 20 }: { dark?: boolean; size?: number; text?: number }) {
  return <span className="inline-flex items-center gap-2"><LogoMark size={size} dark={dark} /><Wordmark dark={dark} size={text} /></span>;
}
