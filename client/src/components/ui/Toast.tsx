import { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/format';

type Push = (text: string, kind?: 'ok' | 'err') => void;
const ToastCtx = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: string; text: string; kind: 'ok' | 'err' }[]>([]);
  const push = useCallback<Push>((text, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems(x => [...x, { id, text, kind }]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-24 right-5 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={cn('flex max-w-sm animate-fade items-start gap-2.5 rounded-2xl px-4 py-3 text-sm text-white shadow-modal', t.kind === 'err' ? 'bg-[#7A1A12]' : 'bg-navy')}>
            <Icon name={t.kind === 'err' ? 'alert' : 'check'} className={t.kind === 'err' ? 'text-[#FFB4AD]' : 'text-accent-b'} />{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
