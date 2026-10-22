import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { CompanyAvatar, StatusChip } from '@/components/ui';
import type { Target } from '@/types/api';

/** One company inside a deletion request. */
export function TargetRow({ requestId, target }: { requestId: string; target: Target }) {
  const t = useT();
  return (
    <Link to={`/app/requests/${requestId}/targets/${target.id}`} className="flex items-center gap-3.5 border-b border-line py-3.5 text-ink last:border-b-0 hover:text-ink">
      <CompanyAvatar company={target.company} size="sm" />
      <span className="min-w-0 flex-1 font-semibold"><span translate="no">{target.company.name}</span>{target.via && <span className="text-[13px] font-normal text-mute"> · {t('via {name}', { name: target.via.name })}</span>}</span>
      <span className="text-[13px] text-mute">{t(target.channel === 'webform' ? 'Web form' : 'Email')}</span>
      <StatusChip status={target.status} short />
    </Link>
  );
}
