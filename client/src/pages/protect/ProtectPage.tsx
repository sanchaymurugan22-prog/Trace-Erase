// Protect a sign-up: a fresh protected email (and the protected number) for a new app.
import { useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { copyText } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { Button, ButtonLink, Card, Chip, CompanyAvatar, DarkPanel, Field, Icon, InputGroup, Timeline, useToast } from '@/components/ui';
import type { Address } from '@/types/api';
import { AddressDialog } from './AddressDialog';
import { useSession } from '@/lib/session';
import { Banner } from '@/components/ui';

export default function ProtectPage() {
  const toast = useToast();
  const t = useT();
  const [app, setApp] = useState('');
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState<Address | null>(null);
  const { data: ident, reload } = useApi<{ addresses: Address[] }>('/identity');
  const go = async (value?: string) => {
    const v = (value ?? app).trim();
    if (!v) return;
    setBusy(true);
    try { const r = await post('/identity/protect', { app: v }); setRes(r); setApp(v); reload(); }
    catch (e: any) { toast(t(e.message), 'err'); } finally { setBusy(false); }
  };
  const addresses = (ident?.addresses || []).filter(a => a.purpose !== 'replies');
  const { flags } = useSession();

  if (flags.protectedEmail === false) return (
    <AppShell>
      <div className="flex flex-col gap-1"><h1 className="text-4xl font-extrabold tracking-tight">{t('Protect a new sign-up')}</h1></div>
      <Banner tone="info" icon="mail"><span className="text-sm">{t('Protected email addresses are not available yet. They need our own email domain to receive mail, which this free setup does not have. Everything else works: scan, delete, escalate and prove. You can try protected addresses in the demo.')}</span></Banner>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-1"><h1 className="text-4xl font-extrabold tracking-tight">{t('Protect a new sign-up')}</h1><p className="text-mute">{t('Signing up for something new? Get a protected email and number for it in one click.')}</p></div>
      <div className="grid grid-cols-2 items-start gap-6 max-[1000px]:grid-cols-1">
        <div className="flex flex-col gap-6">
          <Card className="p-7">
            <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); go(); }}>
              <Field label={t('Which app or website?')} htmlFor="app">
                <div className="flex gap-2">
                  <InputGroup id="app" className="flex-1" value={app} onChange={e => setApp(e.target.value)} placeholder={t('e.g. swiggy.com or Zepto')} prefix={<Icon name="globe" className="text-mute" />} />
                  <Button type="submit" size="lg" loading={busy}>{t('Generate')}</Button>
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-mute">{t('Try:')}</span>
                {['zomato.com', 'swiggy.com', 'irctc.co.in', 'uber.com'].map(x => <button type="button" key={x} onClick={() => go(x)} className="rounded-full bg-soft px-2.5 py-1 text-[13px] font-semibold text-ink2 hover:bg-soft2">{x}</button>)}
              </div>
            </form>
          </Card>
          {res && (
            <DarkPanel className="animate-fade gap-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[17px] font-bold text-white"><CompanyAvatar company={res.company} size="sm" />{t('Ready for {name}', { name: res.company.name })}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-semibold"><Icon name="check" size="sm" className="text-accent-b" />{t('Created')}</span>
              </div>
              {([['mail', 'Email', res.address.email], ...(res.protectedNumber ? [['phone', 'Phone', res.protectedNumber]] : [])] as const).map(([ic, l, v]) => (
                <div key={l} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5">
                  <Icon name={ic} className="text-accent-b" />
                  <span className="flex min-w-0 flex-1 flex-col"><span className="text-[13px] text-onm">{t(l)}</span><span className="truncate font-mono text-lg text-white" translate="no">{v}</span></span>
                  <Button variant="outline" size="sm" onClick={() => copyText(v, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button>
                </div>
              ))}
              {res.policy?.summary && <div className="flex items-start gap-3 rounded-[14px] bg-accent-b/10 p-3.5"><Icon name="sparkle" className="mt-0.5 text-accent-b" /><span className="text-sm text-on">{t(res.policy.summary)}</span></div>}
              <ButtonLink to={`/app/companies/${res.company.id}`} variant="outline" className="self-start">{t('View {name}', { name: res.company.name })}</ButtonLink>
            </DarkPanel>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-xl font-bold">{t('What happens next')}</h2>
            <Timeline items={[
              { icon: 'edit', state: 'current', title: <span className="font-semibold">{t('Use these details to sign up')}</span>, sub: <span className="text-[13px] text-mute">{t('Copy them into the sign-up form.')}</span> },
              { icon: 'inbox', state: 'todo', title: <span className="font-semibold">{t('Their emails reach your inbox')}</span>, sub: <span className="text-[13px] text-mute">{t('Order updates and codes arrive as normal.')}</span> },
              { icon: 'siren', state: 'todo', title: <span className="font-semibold">{t('Anyone else is caught')}</span>, sub: <span className="text-[13px] text-mute">{t('If a stranger uses this address, you get a leak alert.')}</span> }
            ]} />
          </Card>
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between px-6 py-[18px]"><h2 className="text-xl font-bold">{t('Your protected emails')}</h2><Chip>{addresses.filter(a => a.status === 'active').length}</Chip></div>
            {addresses.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>{t('App')}</th><th>{t('Address')}</th><th>{t('Status')}</th><th><span className="sr-only">{t('Manage')}</span></th></tr></thead>
                  <tbody>
                    {addresses.map(a => (
                      <tr key={a.id}>
                        <td><Link to={`/app/companies/${a.companyId}`} className="font-semibold" translate="no">{a.company?.name}</Link></td>
                        <td className="font-mono text-[13px]" translate="no">{a.email}</td>
                        <td>{a.status === 'rotated' ? <Chip>{t('Retired')}</Chip> : a.leaks ? <Chip tone="leak">{t('{n} leaks', { n: a.leaks })}</Chip> : <Chip tone="ok">{t('Healthy')}</Chip>}</td>
                        <td className="text-end"><Button variant="ghost" size="sm" onClick={() => setManaging(a)}>{t('Manage')}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="px-6 pb-5 text-sm text-mute">{t('None yet.')}</div>}
          </Card>
        </div>
      </div>
      {managing && <AddressDialog address={managing} onClose={() => setManaging(null)} onChanged={reload} />}
    </AppShell>
  );
}
