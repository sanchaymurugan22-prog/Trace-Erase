// Delete my data: choose companies → review → sign.
import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { del, post } from '@/lib/api';
import { agoParts } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { AiCard, AiTag, Button, ButtonLink, Card, Chip, CompanyAvatar, EmptyState, ErrorBox, Icon, KeyValue, PageLoading, Steps, useToast } from '@/components/ui';
import type { DeletionRequest, HoldingRow } from '@/types/api';
import { SignRequestDialog } from './SignRequestDialog';

export default function DeletePage() {
  const q = useQuery();
  const toast = useToast();
  const t = useT();
  const { data: rows, loading, error } = useApi<HoldingRow[]>('/companies');
  const [sel, setSel] = useState<Set<string>>(() => new Set((q.ids || '').split(',').filter(Boolean)));
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<DeletionRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const all = rows || [];
  const direct = all.filter(r => !r.via && !['verified', 'partial', 'claimed'].includes(r.status));
  const partnersOf = (id: string) => all.filter(r => r.via?.id === id);
  const visible = direct.filter(r => !search || r.company.name.toLowerCase().includes(search.toLowerCase()));
  const chosen = all.filter(r => sel.has(r.id));
  const withPartners = useMemo(() => {
    const ids = new Set(chosen.map(r => r.id));
    chosen.forEach(r => partnersOf(r.id).forEach(p => ids.add(p.id)));
    return all.filter(r => ids.has(r.id));
  }, [rows, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = withPartners.reduce<Record<string, number>>((m, r) => ({ ...m, [r.channel]: (m[r.channel] || 0) + 1 }), {});
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const unused = direct.filter(r => (r.daysSinceUse ?? 0) > 365);

  const review = async () => {
    setBusy(true);
    try { setDraft(await post<DeletionRequest>('/requests/draft', { companyIds: [...sel] })); } catch (e: any) { toast(t(e.message), 'err'); } finally { setBusy(false); }
  };
  const cancelDraft = async () => { if (draft) await del(`/requests/${draft.id}`).catch(() => {}); setDraft(null); };
  const subline = (r: HoldingRow) => {
    const [tpl, n] = agoParts(r.lastSeen);
    return `${r.daysSinceUse !== null ? t('Last used {when}', { when: t(tpl, { n }).toLowerCase() }) : t(r.company.category)}${r.status !== 'not-asked' ? ` · ${t(r.status)}` : ''}`;
  };

  if (loading) return <AppShell active="/app/requests"><PageLoading /></AppShell>;
  return (
    <AppShell active="/app/requests">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1"><h1 className="text-4xl font-extrabold tracking-tight">{t('Delete my data')}</h1><p className="text-mute">{t('Choose companies. When they reply, we also ask every partner they name.')}</p></div>
        <Steps steps={[t('Choose'), t('Review'), t('Sign')]} current={0} />
      </div>
      <ErrorBox error={error} />
      {!all.length ? (
        <Card><EmptyState icon="building" title="No companies yet" action={<ButtonLink to="/onboarding/connect">{t('Run the AI scan')}</ButtonLink>}>{t('Scan first so we know who has your data.')}</EmptyState></Card>
      ) : (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 max-[1100px]:grid-cols-1">
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <label className="flex h-11 max-w-[320px] flex-1 items-center gap-2.5 rounded-xl bg-soft px-3.5 text-mute">
                <Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Find a company')} aria-label={t('Find a company')} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSel(new Set(unused.map(r => r.id)))}>{t('Select unused ({n})', { n: unused.length })}</Button>
                <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>{t('Clear')}</Button>
              </div>
            </div>
            {visible.map(r => (
              <Fragment key={r.id}>
                <label className="flex cursor-pointer items-center gap-4 border-b border-line px-5 py-[15px] hover:bg-soft/40">
                  <input className="checkbox" type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                  <CompanyAvatar company={r.company} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col"><span className="font-bold" translate="no">{r.company.name}</span><span className="text-[13px] text-mute">{subline(r)}</span></span>
                  <Chip icon={r.channel === 'webform' ? 'globe' : 'mail'}>{t(r.channel === 'webform' ? 'Web form' : 'Email')}</Chip>
                </label>
                {partnersOf(r.id).map(p => (
                  <div key={p.id} className="flex items-center gap-4 border-b border-line bg-soft py-3 pl-16 pr-5">
                    <Icon name="cr" size="sm" className="text-mute" /><CompanyAvatar company={p.company} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold" translate="no">{p.company.name}</span><span className="text-[13px] text-mute">{t('Got your data from {name} · included automatically', { name: r.company.name })}</span></span>
                    {sel.has(r.id) ? <Chip tone="ok" icon="check">{t('Included')}</Chip> : <Chip>{t('If {name} is chosen', { name: r.company.name })}</Chip>}
                  </div>
                ))}
              </Fragment>
            ))}
          </Card>
          <div>
            <Card className="sticky top-6 gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Summary')}</span>
              <span className="text-[28px] font-bold">{t('{n} companies', { n: withPartners.length })}</span>
              <span className="pb-1.5 text-sm text-mute">{t('{n} you chose', { n: chosen.length })}{withPartners.length > chosen.length ? `, ${t('plus {n} partners', { n: withPartners.length - chosen.length })}` : ''}</span>
              {(['email', 'webform'] as const).filter(k => counts[k]).map(k => (
                <KeyValue key={k} label={<span className="flex items-center gap-2"><Icon name={k === 'webform' ? 'globe' : 'mail'} className="text-brand" />{t(k === 'webform' ? 'Web form, text prepared for you' : 'Email, written by AI')}</span>}><b>{counts[k]}</b></KeyValue>
              ))}
              <KeyValue label={<span className="flex items-center gap-2"><Icon name="timer" className="text-mute" />{t('Legal deadline')}</span>}><b>{t('30 days')}</b></KeyValue>
              <AiCard className="mt-2.5 p-4"><AiTag /><span className="text-sm text-ink2">{t("I'll write each request in the format that company accepts, and check every reply for partners it names.")}</span></AiCard>
              <Button size="lg" full className="mt-2.5" disabled={!sel.size} loading={busy} onClick={review}>{t('Review and sign')}<Icon name="ar" /></Button>
            </Card>
          </div>
        </div>
      )}
      {draft && <SignRequestDialog draft={draft} onCancel={cancelDraft} />}
    </AppShell>
  );
}
