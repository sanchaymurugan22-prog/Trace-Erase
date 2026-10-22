import { cn } from '@/lib/format';
export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={cn('inline-block size-[18px] flex-none animate-spin-slow rounded-full border-[2.5px] border-current border-r-transparent', className)} />;
}
