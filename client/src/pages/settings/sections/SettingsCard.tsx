import { cn } from '@/lib/format';
import { Card } from '@/components/ui';

/** A settings section: a card with an id so the left menu can jump to it. */
export function SettingsCard({ id, title, description, children, danger }: { id: string; title: string; description?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <Card id={id} className={cn('scroll-mt-6', danger && 'border-[#F6C4BF]')}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">{title}</h2>
        {description && <p className="text-sm text-mute">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/** One row inside a settings card: text on the left, a control on the right. */
export function SettingRow({ title, sub, children, htmlFor }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; htmlFor?: string }) {
  const Tag = htmlFor ? 'label' : 'div';
  return (
    <Tag htmlFor={htmlFor} className="flex min-h-14 flex-wrap items-center gap-4 border-b border-line py-3 last:border-b-0">
      <span className="flex min-w-[200px] flex-1 flex-col gap-0.5"><span className="font-semibold">{title}</span>{sub && <span className="text-sm text-mute">{sub}</span>}</span>
      {children}
    </Tag>
  );
}
