import { twMerge } from 'tailwind-merge';
// Date and text formatting. Dates follow the selected language.
let locale = 'en-IN';
export const setFormatLocale = (lang: string) => { locale = lang === 'en' ? 'en-IN' : `${lang}-IN`; };

const d = (iso: string | number | Date) => new Date(iso);
export const fmtDate = (iso?: string | null, opts: { year?: boolean } = {}) =>
  iso ? d(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(opts.year ? { year: 'numeric' } : {}) }) : '';
export const fmtDateLong = (iso?: string | null) =>
  iso ? d(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const fmtTime = (iso?: string | null) => (iso ? d(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }) : '');
export const fmtDateTime = (iso?: string | null) => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '');

/** "3 days ago" etc. Returns [english template, n] so the caller can translate it. */
export function agoParts(iso?: string | null, now = Date.now()): [string, number] {
  if (!iso) return ['', 0];
  const days = Math.floor((now - +d(iso)) / 86400000);
  if (days < 1) return ['Today', 0];
  if (days === 1) return ['Yesterday', 1];
  if (days < 30) return ['{n} days ago', days];
  if (days < 60) return ['Last month', 1];
  if (days < 365) return ['{n} months ago', Math.floor(days / 30)];
  const y = Math.floor(days / 365);
  return y === 1 ? ['1 year ago', 1] : ['{n} years ago', y];
}

export const shortHash = (h?: string | null, a = 6, b = 4) => (h ? `${h.slice(0, a)}…${h.slice(-b)}` : '');
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || '?';
/** Join class names; later Tailwind classes win over earlier ones (e.g. a page's className over a component default). */
export const cn = (...parts: (string | false | null | undefined)[]) => twMerge(parts.filter(Boolean).join(' '));

export function copyText(text: string, done?: (msg: string, kind?: 'ok' | 'err') => void) {
  navigator.clipboard?.writeText(text).then(() => done?.('Copied')).catch(() => done?.('Could not copy', 'err'));
}
