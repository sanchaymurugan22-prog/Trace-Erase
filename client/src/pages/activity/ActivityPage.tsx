// Activity log: every email, call and SMS that reached the protected identity, and what TraceErase did with it.
import { useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Chip, EmptyState, Icon, PageLoading, Segmented } from '@/components/ui';
import type { ActivityItem } from '@/types/api';

type Action = 'all' | 'forwarded' | 'blocked' | 'code';
type Channel = 'all' | 'email' | 'call' | 'sms';

export default function ActivityPage() {
  const t = useT();
  const { data, loading } = useApi<{ items: ActivityItem[]; counts: { forwarded: number; blocked: number; codes: number; leaks: number } }>('/activity', { interval: 8000 });
  const [action, setAction] = useState<Action>('all');
  const [channel, setChannel] = useState<Channel>('all');
  const items = (data?.items || []).filter(m =>
    (action === 'all' || (action === 'forwarded' ? ['forwarded', 'rang'].includes(m.action) : m.action === action)) &&
    (channel === 'all' || m.channel === channel));

  return (
    <AppShell>
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-extrabold tracking-tight">{t('Activity log')}</h1>
        <p className="text-mute">{t('Every email, call and SMS that reached your protected identity. We log the sender, never the message content.')}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Kpi label={t('Forwarded this week')} value={data?.counts.forwarded} sub={t('From allowed senders')} />
        <Kpi label={t('Blocked')} value={data?.counts.blocked} sub={t('{n} were leaks', { n: data?.counts.leaks ?? 0 })} tone="text-leak" />
        <Kpi label={t('Codes handled for you')} value={data?.counts.codes} sub={t('Only for your deletion requests')} tone="text-accent" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={action} onChange={setAction} options={[
          { value: 'all', label: t('All') }, { value: 'forwarded', label: t('Forwarded') }, { value: 'blocked', label: t('Blocked') }, { value: 'code', label: t('Codes') }
        ]} />
        <Segmented value={channel} onChange={setChannel} options={[
          { value: 'all', label: t('All channels') }, { value: 'email', label: t('Email') }, { value: 'call', label: t('Calls') }, { value: 'sms', label: t('SMS') }
        ]} />
      </div>

      {loading ? <PageLoading /> : !items.length ? (
        <Card><EmptyState icon="inbox" title="Nothing here yet">{t('When anyone emails a protected address or calls your protected number, it shows up here. Try Demo controls → Messages to send a test.')}</EmptyState></Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('When')}</th><th>{t('From')}</th><th>{t('To your')}</th><th>{t('What we did')}</th><th>{t('Why')}</th></tr></thead>
              <tbody>
                {items.map(m => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-mute">{fmtDateTime(m.at)}</td>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <Icon name={m.channel === 'sms' ? 'chat' : m.channel === 'call' ? 'phone' : 'mail'} className="text-mute" />
                        <span className="flex min-w-0 flex-col"><span className="font-semibold" translate="no">{m.from}</span>{m.subject && <span className="clamp-2 text-[13px] text-mute">{m.subject}</span>}</span>
                      </span>
                    </td>
                    <td className="font-mono text-[13px]" translate="no">{m.to}</td>
                    <td><ActionChip action={m.action} /></td>
                    <td className="text-sm text-mute">{m.leakId ? <Link to={`/app/leaks/${m.leakId}`}>{t(m.why)}</Link> : t(m.why)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}

function ActionChip({ action }: { action: ActivityItem['action'] }) {
  const t = useT();
  if (action === 'blocked') return <Chip tone="leak" icon="ban">{t('Blocked')}</Chip>;
  if (action === 'code') return <Chip tone="accent" icon="key">{t('Code filled')}</Chip>;
  return <Chip tone="ok" icon="check">{t(action === 'rang' ? 'Rang through' : 'Forwarded')}</Chip>;
}

function Kpi({ label, value, sub, tone }: { label: string; value?: number; sub: string; tone?: string }) {
  return (
    <Card className="gap-2">
      <span className="text-sm font-semibold text-mute">{label}</span>
      <span className={`font-display text-[40px] font-extrabold leading-[44px] ${tone || ''}`}>{value ?? '–'}</span>
      <span className="text-[13px] text-mute">{sub}</span>
    </Card>
  );
}
