import { useEffect } from 'react';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

export function Modal({ children, onClose, label, wide, className }: { children: React.ReactNode; onClose?: () => void; label: string; wide?: boolean; className?: string }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/60 p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div role="dialog" aria-modal="true" aria-label={label}
        className={cn('relative flex max-h-[90vh] w-full animate-fade flex-col gap-5 overflow-y-auto rounded-3xl bg-card p-8 shadow-modal', wide ? 'max-w-3xl' : 'max-w-xl', className)}>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-xl text-mute hover:bg-soft hover:text-ink">
            <Icon name="x" size="sm" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
