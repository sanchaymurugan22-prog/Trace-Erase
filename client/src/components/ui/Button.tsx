import { useState, type ButtonHTMLAttributes } from 'react';
import { Link } from '@/lib/router';
import { cn } from '@/lib/format';
import { Spinner } from './Spinner';
import { useToast } from './Toast';
import { useT } from '@/i18n/I18nProvider';

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'white' | 'outline' | 'dark' | 'accent';
export type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'border-transparent bg-brand text-white hover:bg-brand-d hover:text-white',
  secondary: 'border-line2 bg-card text-ink shadow-[0_1px_2px_rgba(10,22,48,.05)] hover:bg-soft hover:text-ink',
  ghost: 'border-transparent bg-transparent text-brand hover:bg-brand-s',
  danger: 'border-transparent bg-leak text-white hover:bg-[#951C12] hover:text-white',
  white: 'border-transparent bg-white text-navy hover:bg-[#E7ECF6] hover:text-navy',
  outline: 'border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white',
  dark: 'border-transparent bg-navy text-white hover:bg-navy3 hover:text-white',
  accent: 'border-transparent bg-accent text-white hover:opacity-90 hover:text-white'
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-[10px]',
  md: 'h-11 px-[18px] text-[15px] rounded-xl',
  lg: 'h-[52px] px-6 text-base rounded-[14px]'
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', full = false, className?: string) =>
  cn('inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold leading-5 no-underline transition-colors disabled:opacity-55',
    VARIANTS[variant], SIZES[size], full && 'w-full', className);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean; loading?: boolean };

export function Button({ variant, size, full, loading, className, children, disabled, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={buttonClass(variant, size, full, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}{children}
    </button>
  );
}

export function ButtonLink({ to, variant, size, full, className, children, ...rest }: { to: string; variant?: Variant; size?: Size; full?: boolean; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <Link to={to} className={buttonClass(variant, size, full, className)} {...rest}>{children}</Link>;
}

/** A button that runs an async action, shows a spinner, and reports errors as a toast. */
export function ActionButton({ onClick, children, ...rest }: Omit<BtnProps, 'onClick'> & { onClick: () => unknown | Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const t = useT();
  return (
    <Button {...rest} loading={busy} onClick={async () => {
      setBusy(true);
      try { await onClick(); } catch (err: any) { toast(t(err?.message || 'Something went wrong'), 'err'); } finally { setBusy(false); }
    }}>{children}</Button>
  );
}

export function LinkButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('border-0 bg-transparent p-0 font-semibold text-brand hover:text-brand-d', className)} {...rest} />;
}
