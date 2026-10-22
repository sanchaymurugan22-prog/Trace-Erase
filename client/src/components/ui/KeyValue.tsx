import { cn } from '@/lib/format';

/** One "label ……… value" row; stack several inside a card. */
export function KeyValue({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-between gap-4 border-b border-dashed border-line py-2.5 text-[14.5px] last:border-b-0', className)}>
      <span className="text-mute">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}
