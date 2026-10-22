// Screen: Create account (name, real email, real mobile).
import { useState } from 'react';
import { Link, useNavigate } from '@/lib/router';
import { useI18n } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { AuthSplit } from '@/components/layout/AuthSplit';
import { Button, Check, CompanyAvatar, Field, Icon, Input, InputGroup, Steps } from '@/components/ui';
import { savePending } from '../shared/pending';
import { firebaseEnabled } from '@/lib/config';
import { continueWithGoogle, googleEnabled, signUpWithEmail } from '@/lib/firebaseAuth';
import { useSession } from '@/lib/session';
import { DemoButton, GoogleButton, OrLine } from '../shared/AuthExtras';

export default function SignupPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { setUser } = useSession();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', agree: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.agree) { setErr(t('Please accept the terms to continue')); return; }
    setBusy(true); setErr('');
    try {
      if (firebaseEnabled) {
        if (f.password.length < 8) throw new Error('Please choose a password with at least 8 characters.');
        const digits = f.phone.replace(/\D/g, '');
        const user = await signUpWithEmail({ name: f.name, email: f.email, password: f.password, phone: digits ? (digits.length === 10 ? '+91' + digits : '+' + digits) : '', language: lang });
        setUser(user);
        navigate(user.verified ? '/passkey' : '/signup/check-email');
        return;
      }
      const r = await post('/auth/signup', { name: f.name, email: f.email, phone: f.phone, language: lang });
      savePending({ mode: 'signup', ...r });
      navigate('/signup/verify');
    } catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true); setErr('');
    try { const user = await continueWithGoogle(lang); setUser(user); navigate(user.onboarding?.scanned ? '/app' : user.hasPasskey ? '/onboarding/identity' : '/passkey'); }
    catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(false); }
  };

  return (
    <AuthSplit left={<>
      <div className="mt-6 flex flex-col gap-3.5">
        <h1 className="text-5xl font-extrabold leading-[56px] tracking-tight text-white max-[820px]:text-3xl">{t('One account.')}<br />{t('Every company covered.')}</h1>
        <p className="max-w-md text-lg leading-[30px] text-onm">{t('Companies will only ever see your protected details. Your real email and number stay with you.')}</p>
      </div>
      <div className="flex max-w-[440px] flex-col gap-4 rounded-3xl border border-white/10 bg-navy2 p-7 shadow-[0_30px_80px_rgba(0,0,0,.35)]" aria-hidden="true">
        <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.08em] text-accent-b">{t('Protected identity')}</span><Icon name="shieldc" className="text-accent-b" /></div>
        <div className="flex flex-col gap-1"><span className="text-[13px] text-onm">{t('Protected number')}</span><span className="font-mono text-[26px] font-bold text-white" translate="no">+91 70000 •••••</span></div>
        {[['Zomato', 'k8', 'zomato.p3x8'], ['Myntra', 'k2', 'myntra.k7f2'], ['Flipkart', 'k9', 'flipkart.q2m9']].map(([n, k, a]) => (
          <div key={n} className="flex items-center gap-3 rounded-[14px] bg-white/5 px-3 py-2.5">
            <CompanyAvatar company={{ name: n, color: k }} size="sm" /><span className="flex-1 font-mono text-[13px] text-on" translate="no">{a}@te.mail</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">{n}</span>
          </div>
        ))}
      </div>
    </>}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Steps steps={[t('Account'), t('Verify'), t('Passkey')]} current={0} />
        <span className="text-sm text-mute">{t('Have an account?')} <Link to="/login" className="font-semibold">{t('Log in')}</Link></span>
      </div>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div className="flex flex-col gap-2"><h2 className="text-4xl font-extrabold tracking-tight">{t('Create your account')}</h2><p className="text-mute">{t('Free for everyone. Takes about 3 minutes.')}</p></div>
        {firebaseEnabled && googleEnabled() && <><GoogleButton onClick={google} disabled={busy} /><OrLine /></>}
        <Field label={t('Full name')} htmlFor="nm"><Input id="nm" required autoComplete="name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t('Real email')} htmlFor="em"><Input id="em" type="email" required autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        {firebaseEnabled && <Field label={t('Password')} htmlFor="pw" hint={t('At least 8 characters.')}><Input id="pw" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>}
        <Field label={firebaseEnabled ? t('Real mobile number (optional)') : t('Real mobile number')} htmlFor="ph" hint={firebaseEnabled ? t('Text-message (SMS) verification is not available on our free plan, so your number is saved without a code check. It is used only in your legal requests.') : undefined}>
          <InputGroup id="ph" dir="ltr" required={!firebaseEnabled} inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="98765 43210"
            prefix={<><span className="font-semibold text-ink2">+91</span><span className="h-6 w-px bg-line2" /></>} />
        </Field>
        <div className="flex items-start gap-3 rounded-2xl bg-accent-s p-4"><Icon name="lock" className="text-accent" /><span className="text-sm text-ink2">{t('Stored only to forward messages to you and to prove your identity in legal requests. Never shown to companies.')}</span></div>
        <Check label={t('I agree to the Terms and Privacy policy')} checked={f.agree} onChange={e => setF({ ...f, agree: e.target.checked })} />
        {err && <span className="text-sm text-leak" role="alert">{err}</span>}
        <Button type="submit" size="lg" full loading={busy}>{t('Create account')}<Icon name="ar" /></Button>
        <DemoButton />
      </form>
    </AuthSplit>
  );
}
