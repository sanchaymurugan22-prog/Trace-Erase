// Side panel: details of the selected company or partner.
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { AiCard, AiTag, ButtonLink, Card, Chip, CompanyAvatar, Icon, Spinner, StatusChip, Well } from '@/components/ui';

export function MapDetail({ id }: { id: string }) {
  const t = useT();
  const { data: d, error } = useApi<any>(`/companies/${id}`);
  if (error) return <Card><span className="text-sm text-mute">{t('Could not load these details.')}</span></Card>;
  if (!d) return <Card><Spinner /></Card>;
  return (
    <Card className="gap-4">
      <div className="flex items-center gap-3">
        <CompanyAvatar company={d.company} />
        <span className="flex min-w-0 flex-1 flex-col"><span className="text-xl font-bold" translate="no">{d.company.name}</span><span className="text-[13px] text-mute">{d.via ? t('Got your data from {name}', { name: d.via.name }) : t(d.company.category)}</span></span>
      </div>
      <div className="flex flex-wrap gap-2"><StatusChip status={d.status} />{d.leaks > 0 && <Chip tone="leak" icon="siren">{t('Leak source')}</Chip>}</div>
      {d.via && (
        <Well><span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('How it got your data')}</span>
          <span className="flex items-center gap-2 text-sm font-semibold"><CompanyAvatar company={d.via} size="sm" className="!size-6 !text-[11px]" />{d.via.name}<Icon name="ar" size="sm" className="text-mute" />{d.company.name}</span>
        </Well>
      )}
      {d.partners.length > 0 && (
        <div className="flex flex-col">
          {d.partners.map((p: any) => (
            <Link key={p.receiptId} to={`/app/receipts/${p.receiptId}`} className="flex items-center gap-3 border-b border-line py-3 text-ink last:border-b-0 hover:text-ink">
              <CompanyAvatar company={p.company} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold">{p.company.name}</span><span className="text-[13px] text-mute">{(p.fields || []).map((f: string) => t(f)).join(', ')} · {t(p.purpose)}</span></span>
              <StatusChip status={p.status} short />
            </Link>
          ))}
        </div>
      )}
      {d.policy?.summary && <AiCard className="p-4"><AiTag ai={d.policy._ai} label="Policy in one line" /><span className="clamp-2 text-sm text-ink2">{t(d.policy.summary)}</span></AiCard>}
      <ButtonLink to={`/app/companies/${d.id}`} variant="secondary" full>{t('Open {name}', { name: d.company.name })}</ButtonLink>
    </Card>
  );
}
