// Review the drafted request and sign it with the passkey.
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { passkeyErrorMessage, signWithPasskey } from '@/lib/webauthn';
import { Button, CompanyAvatar, Icon, Modal, Tile, useToast } from '@/components/ui';
import type { DeletionRequest } from '@/types/api';

export function SignRequestDialog({ draft, onCancel }: { draft: DeletionRequest; onCancel: () => void }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [opts, setOpts] = useState({ autoOtp: user?.settings?.autoOtp !== false, autoEscalate: user?.settings?.autoEscalate !== false });

  const sign = async () => {
    setBusy(true); setErr('');
    try {
      const o = await post(`/requests/${draft.id}/sign/options`);
      const body: Record<string, unknown> = { ...opts };
      if (o.hasPasskey) body.credential = await signWithPasskey(o.options);
      const r = await post<DeletionRequest>(`/requests/${draft.id}/sign`, body);
      toast(t('Request {number} sent to {n} companies', { number: r.number, n: r.total }));
      navigate(`/app/requests/${r.id}`);
    } catch (e: any) { setErr(t(e.name ? passkeyErrorMessage(e) : e.message)); } finally { setBusy(false); }
  };
  const channel = (c: string) => t(c === 'webform' ? 'Web form, text prepared for you' : 'Email, written by AI');

  return (
    <Modal onClose={onCancel} label={t('Sign your deletion request')} wide>
      <div className="flex items-center gap-4">
        <Tile icon="finger" size="lg" />
        <div className="flex flex-col gap-0.5"><h2 className="text-[28px] font-bold">{t('Sign your deletion request')}</h2><span className="text-sm text-mute">{draft.number} · {t('{n} companies', { n: draft.total })} · {t('deadline 30 days')}</span></div>
      </div>
      <div className="max-h-[260px] overflow-auto rounded-[14px] border border-line px-3.5">
        {draft.targets.map(tg => (
          <div key={tg.id} className="flex items-center gap-3.5 border-b border-line py-3 last:border-b-0">
            <CompanyAvatar company={tg.company} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold"><span translate="no">{tg.company.name}</span>{tg.via && <span className="text-[13px] font-normal text-mute"> · {t('partner of {name}', { name: tg.via.name })}</span>}</span>
              <span className="text-[13px] text-mute">{channel(tg.channel)}{tg.legalHolds?.length ? ` · ${t('may keep {what}', { what: tg.legalHolds.map(h => t(h.what).toLowerCase()).join(', ') })}` : ''}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-3 rounded-[14px] bg-soft px-3.5 py-3 text-sm"><input className="checkbox mt-0.5" type="checkbox" checked={opts.autoOtp} onChange={e => setOpts({ ...opts, autoOtp: e.target.checked })} /><span><b>{t('Handle verification codes')}</b> {t('for these requests only. Never logins or payments.')}</span></label>
        <label className="flex items-start gap-3 rounded-[14px] bg-soft px-3.5 py-3 text-sm"><input className="checkbox mt-0.5" type="checkbox" checked={opts.autoEscalate} onChange={e => setOpts({ ...opts, autoEscalate: e.target.checked })} /><span><b>{t('Escalate if ignored:')}</b> {t('reminder on day 7, formal grievance on day 10, complaint ready on day 15.')}</span></label>
      </div>
      <span className="text-[13px] text-mute">{t('Signing creates a fingerprint of exactly this request ({hash}…) that your passkey signs.', { hash: draft.payloadHash?.slice(0, 14) })}</span>
      {err && <span className="text-sm text-leak" role="alert">{err}</span>}
      <div className="flex gap-2">
        <Button size="lg" className="flex-1" loading={busy} onClick={sign}>{!busy && <Icon name="finger" />}{t(user?.hasPasskey ? 'Confirm with passkey' : 'Confirm and send')}</Button>
        <Button size="lg" variant="secondary" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </Modal>
  );
}
