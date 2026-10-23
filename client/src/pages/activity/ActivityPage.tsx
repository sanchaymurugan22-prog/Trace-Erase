// Activity log: every email, call and SMS that reached the protected identity, and what TraceErase did with it.
import { useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Chip, EmptyState, Icon, PageLoading, Segmented, type IconName } from '@/components/ui';
import type { ActivityItem } from '@/types/api';

type Action = 'all' | 'forwarded' | 'blocked' | 'code';
type Channel = 'all' | 'email' | 'call' | 'sms';

type Kind = 'all' | 'account' | 'settings' | 'scan' | 'request' | 'letter' | 'reply' | 'escalation' | 'protect' | 'leak' | 'evidence' | 'alert';
type AccountItem = { id: string; at: string; kind: Exclude<Kind, 'all'>; title: string; detail?: string; link?: string | null; actor: string };
const KIND: Record<Exclude<Kind, 'all'>, { icon: IconName; label: string; tone: string }> = {
  account: { icon: 'key', label: 'Sign-ins', tone: 'bg-brand-s text-brand' },
  settings: { icon: 'settings', label: 'Settings', tone: 'bg-soft text-ink2' },
  scan: { icon: 'search', label: 'Scans', tone: 'bg-accent-s text-accent' },
  request: { icon: 'trash', label: 'Requests', tone: 'bg-brand-s text-brand' },
  letter: { icon: 'send', label: 'Letters', tone: 'bg-brand-s text-brand' },
  reply: { icon: 'mail', label: 'Replies', tone: 'bg-accent-s text-accent' },
  escalation: { icon: 'timer', label: 'Escalations', tone: 'bg-[#FFF4D6] text-[#8A5A00]' },
  protect: { icon: 'shieldc', label: 'Protection', tone: 'bg-accent-s text-accent' },
  leak: { icon: 'siren', label: 'Leaks', tone: 'bg-leak-s text-leak' },
  evidence: { icon: 'file', label: 'Proof', tone: 'bg-soft text-ink2' },
  alert: { icon: 'bell', label: 'Alerts', tone: 'bg-soft text-ink2' }
};

export default function ActivityPage() {
  const t = useT();
  const [tab, setTab] = useState<'account' | 'inbox'>('account');
  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">{t('Activity log')}</h1>
          <p className="text-mute">{t('Everything you did and everything TraceErase did for you, with the time.')}</p>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'account', label: t('Your activity') }, { value: 'inbox', label: t('Messages to your protected details') }]} />
      </div>
      {tab === 'account' ? <AccountLog /> : <InboxLog />}
    </AppShell>
  );
}

function AccountLog() {
  const t = useT();
  const { data, loading } = useApi<AccountItem[]>('/activity/account', { interval: 8000 });
  const [kind, setKind] = useState<Kind>('all');
  const [who, setWho] = useState<'all' | 'you' | 'TraceErase'>('all');
  const all = data || [];
  const items = all.filter(a => (kind === 'all' || a.kind === kind) && (who === 'all' || a.actor === who));
  const kinds = (Object.keys(KIND) as Exclude<Kind, 'all'>[]).filter(k => all.some(a => a.kind === k));
  const days: [string, AccountItem[]][] = [];
  for (const a of items) {
    const d = new Date(a.at).toDateString();
    const last = days.at(-1);
    if (last && last[0] === d) last[1].push(a); else days.push([d, [a]]);
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', ...kinds] as Kind[]).map(k => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${kind === k ? 'border-brand bg-brand text-white' : 'border-line2 bg-card text-ink2 hover:bg-soft'}`}>
              {k !== 'all' && <Icon name={KIND[k].icon} size="sm" />}{t(k === 'all' ? 'All' : KIND[k].label)} <span className={kind === k ? 'text-white/80' : 'text-mute'}>{k === 'all' ? all.length : all.filter(a => a.kind === k).length}</span>
            </button>
          ))}
        </div>
        <Segmented value={who} onChange={setWho} options={[{ value: 'all', label: t('Everyone') }, { value: 'you', label: t('By you') }, { value: 'TraceErase', label: t('By TraceErase') }]} />
      </div>
      {loading ? <PageLoading /> : !items.length ? (
        <Card><EmptyState icon="inbox" title="Nothing here yet">{t('Sign-ins, scans, deletion requests, letters, replies and settings changes appear here as they happen.')}</EmptyState></Card>
      ) : days.map(([d, list]) => (
        <Card key={d} className="gap-0 p-0">
          <div className="border-b border-line bg-soft px-6 py-3 text-xs font-bold uppercase tracking-[.08em] text-mute">{fmtDate(list[0].at, { year: true })}</div>
          {list.map(a => {
            const k = KIND[a.kind] || KIND.alert;
            const row = (
              <div className="flex items-start gap-4 px-6 py-4">
                <span className={`inline-flex size-9 flex-none items-center justify-center rounded-xl ${k.tone}`}><Icon name={k.icon} size="sm" /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-ink">{t(a.title)}</span>
                  {a.detail && <span className="text-sm text-mute">{t(a.detail)}</span>}
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  <span className="whitespace-nowrap text-[13px] text-mute">{new Date(a.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  <Chip className="h-6 text-xs">{a.actor === 'you' ? t('You') : 'TraceErase'}</Chip>
                </span>
              </div>
            );
            return a.link ? <Link key={a.id} to={a.link} className="block border-b border-line text-ink last:border-b-0 hover:bg-soft hover:text-ink">{row}</Link> : <div key={a.id} className="border-b border-line last:border-b-0">{row}</div>;
          })}
        </Card>
      ))}
    </>
  );
}

function InboxLog() {
  const t = useT();
  const { data, loading } = useApi<{ items: ActivityItem[]; counts: { forwarded: number; blocked: number; codes: number; leaks: number } }>('/activity', { interval: 8000 });
  const [action, setAction] = useState<Action>('all');
  const [channel, setChannel] = useState<Channel>('all');
  const items = (data?.items || []).filter(m =>
    (action === 'all' || (action === 'forwarded' ? ['forwarded', 'rang'].includes(m.action) : m.action === action)) &&
    (channel === 'all' || m.channel === channel));

  return (
    <>
      <p className="-mt-2 text-mute">{t('Every email, call and SMS that reached your protected identity. We log the sender, never the message content.')}</p>

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
    </>
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
