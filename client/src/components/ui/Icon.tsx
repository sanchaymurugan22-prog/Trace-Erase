import { ICONS, type IconName } from './icons';
import { cn } from '@/lib/format';

const SIZES = { xs: 'size-3.5', sm: 'size-4', md: 'size-5', lg: 'size-6', xl: 'size-8', xxl: 'size-12' } as const;

export function Icon({ name, size = 'md', className, style }: { name: IconName; size?: keyof typeof SIZES; className?: string; style?: React.CSSProperties }) {
  const icon = ICONS[name];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={icon.w} strokeLinecap="round" strokeLinejoin="round"
      className={cn('inline-block flex-none', SIZES[size], className)} style={style} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.d }} />
  );
}
export type { IconName };
