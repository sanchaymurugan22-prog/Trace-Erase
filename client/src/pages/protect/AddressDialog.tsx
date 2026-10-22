// Manage one protected email: copy it, choose who may email it, or replace it with a new address.
import { useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { copyText } from '@/lib/format';
import { ActionButton, Button, Chip, CompanyAvatar, Icon, InputGroup, Modal, useToast } from '@/components/ui';
import type { Address } from '@/types/api';

export function AddressDialog({ address, onClose, onChanged }: { address: Address; onClose: () => void; onChanged: () => void }) {
  const t = useT();
  const toast = useToast();
  const [a, setA] = useState(address);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const active = a.status === 'active';

  const update = (next: Address) => { setA({ ...a, ...next }); onChanged(); };
  const allow = async () => {
    const d = domain.trim();
    if (!d) return;
    setBusy(true);
    try { update(await post<Address>(`/identity/addresses/${a.id}/allow`, { domain: d })); setDomain(''); }
    catch (e: any) { toast(t(e.message), 'err'); } finally { setBusy(false); }
  };
  const remove = async (d: string, list: 'allowed' | 'blocked') => update(await post<Address>(`/identity/addresses/${a.id}/senders/remove`, { domain: d, list }));
  const rotate = async () => {
    const fresh = await post<Address>(`/identity/addresses/${a.id}/rotate`);
    toast(t('New address {email}', { email: fresh.email }));
    onChanged(); onClose();
  };

  return (
    <Modal label={t('Manage protected addresses')} onClose={onClose}>
      <div className="flex items-center gap-3 pr-8">
        {a.company && <CompanyAvatar company={a.company} />}
        <div className="flex min-w-0 flex-col">
          <h2 className="text-xl font-bold">{t('Protected email for {name}', { name: a.company?.name || '' })}</h2>
          {active ? <Chip tone={a.leaks ? 'leak' : 'ok'} className="self-start">{a.leaks ? t('{n} leaks', { n: a.leaks }) : t('Healthy')}</Chip> : <Chip className="self-start">{t('Retired')}</Chip>}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-soft px-4 py-3">
        <Icon name="mail" className="text-brand" />
        <span className="min-w-0 flex-1 truncate font-mono text-[15px]" translate="no">{a.email}</span>
        <Button variant="secondary" size="sm" onClick={() => copyText(a.email, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="font-bold">{t('Who may use this address')}</h3>
        <p className="text-sm text-mute">{t('Each address knows its allowed senders and learns from your choices.')}</p>
        <div className="flex flex-col rounded-2xl border border-line px-4">
          {a.allowed.map(d => (
            <div key={'a' + d} className="flex min-h-11 items-center gap-3 border-b border-line last:border-b-0">
              <Icon name="check" className="text-ok" /><span className="flex-1 text-sm" translate="no">{d}</span>
              <Chip tone="ok">{t('Allowed')}</Chip>
              {active && <button className="inline-flex size-8 items-center justify-center rounded-lg text-mute hover:bg-soft hover:text-ink" aria-label={t('Remove')} onClick={() => remove(d, 'allowed')}><Icon name="x" size="sm" /></button>}
            </div>
          ))}
          {(a.blockedSenders || []).map(d => (
            <div key={'b' + d} className="flex min-h-11 items-center gap-3 border-b border-line last:border-b-0">
              <Icon name="ban" className="text-leak" /><span className="flex-1 text-sm" translate="no">{d}</span>
              <Chip tone="leak">{t('Blocked')}</Chip>
              {active && <button className="inline-flex size-8 items-center justify-center rounded-lg text-mute hover:bg-soft hover:text-ink" aria-label={t('Remove')} onClick={() => remove(d, 'blocked')}><Icon name="x" size="sm" /></button>}
            </div>
          ))}
          {!a.allowed.length && !(a.blockedSenders || []).length && <span className="py-3 text-sm text-mute">{t('None yet.')}</span>}
        </div>
        {active && (
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); allow(); }}>
            <InputGroup className="flex-1" value={domain} onChange={e => setDomain(e.target.value)} placeholder={t('e.g. swiggy.com or Zepto')} aria-label={t('Allowed sender')} prefix={<Icon name="globe" className="text-mute" />} />
            <Button type="submit" variant="secondary" loading={busy} disabled={!domain.trim()}><Icon name="plus" size="sm" />{t('Allow')}</Button>
          </form>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <Link to={`/app/companies/${a.companyId}`} className="text-sm font-semibold" onClick={onClose}>{t('View {name}', { name: a.company?.name || '' })}</Link>
        {active && <ActionButton variant="secondary" onClick={rotate}><Icon name="refresh" size="sm" />{t('Rotate this address')}</ActionButton>}
      </div>
      {active && <p className="-mt-2 text-[13px] text-mute">{t('The old one stops working')}</p>}
    </Modal>
  );
}
