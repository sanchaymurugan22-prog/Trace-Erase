import { cn } from '@/lib/format';
import { Icon, type IconName } from './Icon';
import { Tile } from './Tile';
import { Button } from './Button';
import { useT } from '@/i18n/I18nProvider';

export function EmptyState({ icon = 'inbox', title, children, action }: { icon?: IconName; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex animate-fade flex-col items-center gap-3 px-6 py-10 text-center text-mute">
      <Tile icon={icon} tone="neutral" size="lg" />
      <span className="font-display text-[17px] font-bold text-ink">{t(title)}</span>
      {children && <span className="max-w-md text-sm">{children}</span>}
      {action}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton h-32', className)} />;

export function PageLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-11 w-80" />
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: any; retry?: () => void }) {
  const t = useT();
  if (!error) return null;
  return (
    <Banner tone="leak" icon="alert">
      <span className="flex-1 text-sm">{t(error.message || String(error))}</span>
      {retry && <Button variant="secondary" size="sm" onClick={retry}>{t('Try again')}</Button>}
    </Banner>
  );
}

const BANNERS = {
  leak: 'bg-leak-s border-[#F6C4BF] [&>svg]:text-leak',
  warn: 'bg-nr-s border-[#F5CFAE] [&>svg]:text-nr',
  info: 'bg-brand-s border-[#CAD7FA] [&>svg]:text-brand',
  ok: 'bg-ok-s border-[#BFE3CC] [&>svg]:text-ok'
};

export function Banner({ tone = 'info', icon, children, className }: { tone?: keyof typeof BANNERS; icon?: IconName; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3.5 rounded-2xl border px-[18px] py-4 text-ink', BANNERS[tone], className)}>
      {icon && <Icon name={icon} />}
      {children}
    </div>
  );
}
