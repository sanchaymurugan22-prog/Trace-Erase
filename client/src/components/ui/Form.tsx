import { forwardRef, useState } from 'react';
import { cn } from '@/lib/format';
import { useT } from '@/i18n/I18nProvider';
import { Icon } from './Icon';

export const inputClass = 'h-12 w-full rounded-xl border-[1.5px] border-line2 bg-card px-3.5 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:opacity-60';

export function Field({ label, htmlFor, hint, children, className }: { label?: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">{label}</label>}
      {children}
      {hint && <span className="text-[13px] text-mute">{hint}</span>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
});

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'h-auto resize-y py-3 leading-6', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'cursor-pointer pr-8', className)} {...rest}>{children}</select>;
}

/** Input with something inside on the left (an icon, a prefix like +91). */
export function InputGroup({ prefix, className, dir, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { prefix: React.ReactNode }) {
  return (
    <div dir={dir} className={cn('flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-line2 bg-card px-3.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15', className)}>
      {prefix}
      <input className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" {...rest} />
    </div>
  );
}

/** Password box with a show / hide eye button. */
export function PasswordInput({ className, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  const t = useT();
  return (
    <div className={cn('flex h-12 items-center rounded-xl border-[1.5px] border-line2 bg-card pl-3.5 pr-1.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15', className)}>
      <input type={show ? 'text' : 'password'} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" {...rest} />
      <button type="button" onClick={() => setShow(v => !v)} aria-label={t(show ? 'Hide password' : 'Show password')} aria-pressed={show}
        className="inline-flex size-9 flex-none items-center justify-center rounded-lg text-mute hover:bg-soft hover:text-ink">
        <Icon name={show ? 'eyeoff' : 'eye'} />
      </button>
    </div>
  );
}

export function Check({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return <label className={cn('flex cursor-pointer items-center gap-3 text-sm', className)}><input type="checkbox" className="checkbox" {...rest} />{label}</label>;
}

export function Toggle(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" role="switch" className="switch" {...props} />;
}
