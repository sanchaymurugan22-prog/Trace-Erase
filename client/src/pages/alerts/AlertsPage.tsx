// Alerts: leaks, replies, deadlines and complaints, newest first, with what to do next.
import { useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { cn, fmtDate, fmtTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, ButtonLink, Card, EmptyState, Icon, Skeleton, Tabs, Tile } from '@/components/ui';
import type { Alert } from '@/types/api';
import { AlertPreferences } from './AlertPreferences';
import { ALERT_LOOK, actionLabel } from './alertLook';

type Filter = 'all' | 'action' | 'leak' | 'reply' | 'complaint' | 'share';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'action', label: 'Needs action' },
  { value: 'leak', label: 'Leaks' },
  { value: 'reply', label: 'Replies' },
  { value: 'complaint', label: 'Complaints' },
  { value: 'share', label: 'Sharing' }
];

const matches = (a: Alert, f: Filter) => f === 'all' || (f === 'action' ? a.needsAction && !a.read : a.type === f);

export default function AlertsPage() {
  const t = useT();
  const { data, loading, reload } = useApi<Alert[]>('/alerts', { interval: 10000 });
  const [filter, setFilter] = useState<Filter>('all');
  const all = data || [];
  const list = all.filter(a => matches(a, filter));
  const today = new Date().toDateString();
  const groups: [string, Alert[]][] = ([
    ['Today', list.filter(a => new Date(a.at).toDateString() === today)],
    ['Earlier', list.filter(a => new Date(a.at).toDateString() !== today)]
  ] as [string, Alert[]][]).filter(g => g[1].length > 0);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">{t('Alerts')}</h1>
          <p className="text-mute">{t('Leaks, replies and deadlines. Each one says what happened and what to do next.')}</p>
        </div>
        <ActionButton variant="secondary" onClick={async () => { await post('/alerts/read-all'); reload(); window.dispatchEvent(new Event('te:refresh')); }}>
          <Icon name="check" />{t('Mark all as read')}
        </ActionButton>
      </div>

      <Tabs value={filter} onChange={setFilter} options={FILTERS.map(f => ({ value: f.value, label: <>{t(f.label)} <span className="text-mute">· {all.filter(a => matches(a, f.value)).length}</span></> }))} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="gap-0 overflow-hidden p-0">
          {loading ? <div className="flex flex-col gap-3 p-6"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            : !groups.length ? <EmptyState icon="bell" title="No alerts here">{t("We'll tell you the moment something happens.")}</EmptyState>
            : groups.map(([label, items]) => (
              <section key={label}>
                <div className="border-b border-line bg-soft px-6 py-3 text-xs font-bold uppercase tracking-[.08em] text-mute">{t(label)}</div>
                {items.map(a => {
                  const [icon, tone] = ALERT_LOOK[a.type] || ['bell', 'neutral'];
                  return (
                    <article key={a.id} className={cn('flex items-start gap-4 border-b border-line px-6 py-[18px] last:border-b-0', !a.read && 'bg-brand-s/50')}>
                      <Tile icon={icon} tone={tone} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold">{t(a.title)}</span>
                          <span className="whitespace-nowrap text-[13px] text-mute">{new Date(a.at).toDateString() === today ? fmtTime(a.at) : fmtDate(a.at)}</span>
                        </div>
                        {a.body && <span className="text-sm text-mute">{t(a.body)}</span>}
                        {a.link && (
                          <div className="mt-1.5 flex gap-2">
                            <ButtonLink to={a.link} size="sm" variant={a.type === 'leak' ? 'danger' : a.needsAction ? 'primary' : 'secondary'}
                              onClick={() => { post(`/alerts/${a.id}/read`).catch(() => {}); }}>
                              {t(actionLabel(a))}<Icon name="ar" size="sm" />
                            </ButtonLink>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
        </Card>
        <AlertPreferences />
      </div>
      <p className="text-[13px] text-mute">{t('Looking for something older?')} <Link to="/app/activity">{t('Open the activity log')}</Link></p>
    </AppShell>
  );
}
