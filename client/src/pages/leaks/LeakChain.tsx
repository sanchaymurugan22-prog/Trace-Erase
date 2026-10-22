// The path the leaked address travelled: You → company → partner → stranger.
import { Fragment } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { CompanyAvatar } from '@/components/ui';
import type { Company, LeakChainNode } from '@/types/api';

export function LeakChain({ chain, company }: { chain: LeakChainNode[]; company: Company }) {
  const t = useT();
  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-1">
      {chain.map((n, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="mt-6 h-0.5 min-w-6 flex-1"
              style={{ background: n.leak ? 'repeating-linear-gradient(90deg, var(--color-leak) 0 6px, transparent 6px 11px)' : 'var(--color-line2)' }} />
          )}
          <div className="flex min-w-[96px] max-w-[132px] flex-none flex-col items-center gap-2 text-center">
            {n.name === 'You'
              ? <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-white">{t('You')}</span>
              : n.leak
                ? <span className="inline-flex size-[52px] items-center justify-center rounded-2xl border-[1.5px] border-leak bg-leak-s font-display text-xl font-extrabold text-leak" translate="no">{n.name[0]}</span>
                : <CompanyAvatar company={{ name: n.name, color: n.name === company.name ? company.color : 'k7' }} className="size-[52px] rounded-2xl" />}
            <span className={n.leak ? 'text-sm font-bold text-leak' : 'text-sm font-bold'} translate="no">{n.name === 'You' ? t('You') : n.name}</span>
            {n.note && <span className="text-[13px] leading-5 text-mute">{t(n.note)}</span>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
