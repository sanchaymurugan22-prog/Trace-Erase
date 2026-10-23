// Screen: Log in (passkey, or a one-time code). Regulators have their own log-in.
import { useState } from 'react';
import { Link, useNavigate, useQuery } from '@/lib/router';
import { useSession } from '@/lib/session';
import { post } from '@/lib/api';
import { passkeyErrorMessage, passkeysSupported, signWithPasskey } from '@/lib/webauthn';
import { AuthSplit } from '@/components/layout/AuthSplit';
import { Button, Field, Icon, Input, PasswordInput, Tile, type IconName } from '@/components/ui';
import { savePending } from '../shared/pending';
import { firebaseEnabled } from '@/lib/config';
import { continueWithGoogle, googleEnabled, logInWithEmail, sendPasswordReset } from '@/lib/firebaseAuth';
import { useI18n } from '@/i18n/I18nProvider';
import { DemoButton, GoogleButton, OrLine } from '../shared/AuthExtras';

export default function LoginPage() {
  const navigate = useNavigate();
  const q = useQuery();
  const { setUser } = useSession();
  const { t, lang } = useI18n();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const after = (u: any) => navigate(q.next && q.next.startsWith('/app') ? q.next : u.onboarding?.scanned ? '/app' : '/onboarding/identity');

  const withPasskey = async () => {
    setBusy('pk'); setErr('');
    try {
      const opts = await post('/auth/passkey/login/options');
      const cred = await signWithPasskey(opts);
      const r = await post('/auth/passkey/login/verify', { credential: cred });
      setUser(r.user);
      after(r.user);
    } catch (e: any) { setErr(t(e.name ? passkeyErrorMessage(e) : e.message)); } finally { setBusy(''); }
  };
  const withPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('pw'); setErr(''); setInfo('');
    try {
      const u = await logInWithEmail(id, pw);
      setUser(u);
      if (!u.verified) navigate('/signup/check-email'); else after(u);
    } catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(''); }
  };
  const withGoogle = async () => {
    setBusy('g'); setErr(''); setInfo('');
    try { const u = await continueWithGoogle(lang); setUser(u); u.hasPasskey || u.onboarding?.scanned ? after(u) : navigate('/passkey'); }
    catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(''); }
  };
  const forgot = async () => {
    if (!id.includes('@')) { setErr(t('Type your email above first.')); return; }
    setBusy('reset'); setErr('');
    try { await sendPasswordReset(id); setInfo(t('We sent a password reset link to {email}.', { email: id })); }
    catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(''); }
  };
  const withCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('code'); setErr('');
    try {
      const r = await post('/auth/login/code', { identifier: id });
      savePending({ mode: 'login', identifier: id, ...r });
      navigate('/signup/verify');
    } catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(''); }
  };

  const away: [IconName, string][] = [['check', 'Companies reply, we check them with AI'], ['ban', 'Strangers who email you are blocked'], ['timer', 'Deadlines escalate automatically']];
  return (
    <AuthSplit left={<>
      <div className="mt-auto flex flex-col gap-3.5">
        <h1 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-3xl">{t('Welcome back.')}</h1>
        <p className="max-w-md text-lg leading-[30px] text-onm">{t('We kept watching your protected addresses while you were away.')}</p>
      </div>
      <div className="max-w-[460px] rounded-3xl border border-white/10 bg-navy2 p-6" aria-hidden="true">
        <span className="text-xs font-bold uppercase tracking-[.08em] text-accent-b">{t('While you were away')}</span>
        {away.map(([ic, s]) => <div key={s} className="flex items-center gap-3 border-b border-white/8 py-3 text-on last:border-b-0"><Tile icon={ic} tone="dark" size="sm" /><span className="text-sm">{t(s)}</span></div>)}
      </div>
      <span className="mt-auto" />
    </>}>
      <div className="flex justify-end"><span className="text-sm text-mute">{t('New here?')} <Link to="/signup" className="font-semibold">{t('Create an account')}</Link></span></div>
      <form className="flex flex-col gap-5" onSubmit={firebaseEnabled ? withPassword : withCode}>
        <div className="flex flex-col gap-2"><h2 className="text-4xl font-extrabold tracking-tight">{t('Log in')}</h2><p className="text-mute">{t('The fastest way is your passkey: fingerprint, face or device PIN.')}</p></div>
        {passkeysSupported() && <Button size="lg" full className="h-[60px]" loading={busy === 'pk'} disabled={!!busy} onClick={withPasskey}>{busy !== 'pk' && <Icon name="finger" size="lg" />}{t('Log in with passkey')}</Button>}
        {firebaseEnabled ? (
          <>
            {googleEnabled() && <GoogleButton onClick={withGoogle} disabled={!!busy} />}
            <OrLine text="or use your email and password" />
            <Field label={t('Email')} htmlFor="idf"><Input id="idf" type="email" required value={id} onChange={e => setId(e.target.value)} autoComplete="username" /></Field>
            <Field label={t('Password')} htmlFor="pwf"><PasswordInput id="pwf" required value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" /></Field>
            <Button type="submit" variant="secondary" size="lg" full loading={busy === 'pw'} disabled={!!busy}>{t('Log in')}</Button>
            <button type="button" className="self-center text-sm font-semibold text-brand" onClick={forgot} disabled={!!busy}>{t('Forgot password?')}</button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-[13px] text-mute before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">{t('or get a one-time code')}</div>
            <Field label={t('Email or mobile number')} htmlFor="idf"><Input id="idf" required value={id} onChange={e => setId(e.target.value)} autoComplete="username" /></Field>
            <Button type="submit" variant="secondary" size="lg" full loading={busy === 'code'} disabled={!!busy}>{t('Send me a code')}</Button>
          </>
        )}
        {err && <span className="text-sm text-leak" role="alert">{err}</span>}
        {info && <span className="text-sm text-ok" role="status">{info}</span>}
        <DemoButton />
        <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-soft px-4 py-3 text-sm text-ink2">
          <Icon name="scale" size="sm" className="text-part" />{t('Data Protection Board officer?')} <Link to="/regulator/login" className="font-semibold">{t('Regulator login')}</Link>
        </div>
      </form>
    </AuthSplit>
  );
}
