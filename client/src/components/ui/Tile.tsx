import { cn } from '@/lib/format';
import { Icon, type IconName } from './Icon';

const TONES = {
  brand: 'bg-brand-s text-brand', accent: 'bg-accent-s text-accent', leak: 'bg-leak-s text-leak', part: 'bg-part-s text-part',
  nr: 'bg-nr-s text-nr', ok: 'bg-ok-s text-ok', dark: 'bg-white/10 text-accent-b', neutral: 'bg-soft text-ink2'
};
const SIZES = { sm: 'size-9 rounded-[10px]', md: 'size-11 rounded-xl', lg: 'size-14 rounded-2xl' };

/** Rounded square with an icon. */
export function Tile({ icon, tone = 'brand', size = 'md', className }: { icon: IconName; tone?: keyof typeof TONES; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn('inline-flex flex-none items-center justify-center', TONES[tone], SIZES[size], className)}>
      <Icon name={icon} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />
    </span>
  );
}
