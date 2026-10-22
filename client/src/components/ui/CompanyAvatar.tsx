import { cn } from '@/lib/format';

const COLORS: Record<string, string> = {
  k1: 'bg-k1', k2: 'bg-k2', k3: 'bg-k3', k4: 'bg-k4', k5: 'bg-k5', k6: 'bg-k6', k7: 'bg-k7', k8: 'bg-k8', k9: 'bg-k9', k10: 'bg-k10'
};
const SIZES = { sm: 'size-9 rounded-[10px] text-sm', md: 'size-11 rounded-xl text-[17px]', lg: 'size-16 rounded-[18px] text-[26px]' };

/** Coloured monogram for a company (no third-party logos). */
export function CompanyAvatar({ company, size = 'md', className }: { company?: { name?: string; color?: string } | null; size?: keyof typeof SIZES; className?: string }) {
  if (!company) return null;
  const letter = (company.name || '?').replace(/[^A-Za-z0-9]/g, '')[0]?.toUpperCase() || '?';
  return (
    <span className={cn('inline-flex flex-none items-center justify-center font-display font-extrabold leading-none text-white', COLORS[company.color || 'k7'] || 'bg-k7', SIZES[size], className)} aria-hidden="true" translate="no">
      {letter}
    </span>
  );
}
