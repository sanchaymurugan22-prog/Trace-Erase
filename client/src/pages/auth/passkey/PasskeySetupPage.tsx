// Screen: Create a passkey (fingerprint / face / screen lock) to sign deletion requests.
import { useState } from 'react';
import { Link, useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { createPasskey, passkeyErrorMessage, passkeysSupported } from '@/lib/webauthn';
import { AuthSplit } from '@/components/layout/AuthSplit';
import { Banner, Button, Icon, Steps, Tile, type IconName } from '@/components/ui';
import { SignupSteps } from '../shared/SignupSteps';

export default function PasskeySetupPage() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const create = async () => {
    setBusy(true); setErr('');
    try {
      const opts = await post('/auth/passkey/register/options');
      const cred = await createPasskey(opts);
      await post('/auth/passkey/register/verify', { credential: cred, label: navigator.userAgent.includes('Mac') ? 'Passkey on this Mac' : 'Passkey on this device' });
      await refresh();
      navigate('/onboarding/identity');
    } catch (e: any) { setErr(t(e.name ? passkeyErrorMessage(e) : e.message)); } finally { setBusy(false); }
  };
  const perks: [IconName, string, string][] = [['key', 'No password', 'to forget or have stolen'], ['edit', 'Signs every request', 'you send to a company'], ['shieldc', 'Accepted as proof', 'in your complaints']];
  return (
    <AuthSplit left={<>
      <div className="mt-auto flex flex-col gap-3.5">
        <h1 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-3xl">{t('Your fingerprint is your signature.')}</h1>
        <p className="max-w-md text-lg leading-[30px] text-onm">{t('Every deletion request is signed by you, so no one can fake one in your name.')}</p>
      </div>
      <div className="mb-auto"><SignupSteps at={3} /></div>
    </>}>
      <Steps steps={[t('Account'), t('Verify'), t('Passkey')]} current={2} />
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex size-44 items-center justify-center rounded-full bg-brand-s shadow-[0_0_0_14px_rgba(35,80,216,.05),0_0_0_28px_rgba(35,80,216,.03)]" aria-hidden="true">
          <span className="flex size-28 items-center justify-center rounded-full bg-brand text-white shadow-[0_16px_40px_rgba(35,80,216,.35)]"><Icon name="finger" size="xxl" /></span>
        </div>
        <div className="mt-4 flex flex-col gap-2"><h2 className="text-4xl font-extrabold tracking-tight">{t('Create your passkey')}</h2><p className="text-mute">{t('Your device will ask for your fingerprint, face or screen lock. Nothing leaves your device.')}</p></div>
        <div className="flex w-full flex-col gap-3 text-left">
          {perks.map(([ic, b, s]) => <div key={b} className="flex items-center gap-3"><Tile icon={ic} tone="accent" size="sm" /><span className="text-sm"><b>{t(b)}</b> {t(s)}</span></div>)}
        </div>
        {!passkeysSupported() && <Banner tone="warn" icon="alert"><span className="text-sm">{t("This browser doesn't support passkeys. You can continue and sign requests with your account instead.")}</span></Banner>}
        {err && <span className="text-sm text-leak" role="alert">{err}</span>}
        <Button size="lg" full loading={busy} disabled={!passkeysSupported()} onClick={create}>{!busy && <Icon name="finger" />}{t('Create passkey')}</Button>
        <Link to="/onboarding/identity" className="text-sm font-semibold">{t('Skip for now')}</Link>
      </div>
    </AuthSplit>
  );
}
