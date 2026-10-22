// Screen: Enter the one-time codes (sign-up: email + SMS; log-in: one code).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { AuthSplit } from '@/components/layout/AuthSplit';
import { Button, Icon, LinkButton, OtpInput, Steps, useToast } from '@/components/ui';
import { SignupSteps } from '../shared/SignupSteps';
import { clearPending, loadPending, savePending, type PendingAuth } from '../shared/pending';

export default function VerifyCodesPage() {
  const navigate = useNavigate();
  const { setUser } = useSession();
  const t = useT();
  const toast = useToast();
  const [p, setP] = useState<PendingAuth | null>(loadPending);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(45);

  useEffect(() => { const i = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!p) navigate('/signup', { replace: true }); }, [p, navigate]);
  if (!p) return null;
  const signup = p.mode === 'signup';
  const showEmail = signup || p.channel === 'email';
  const showPhone = signup || p.channel === 'phone';

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = signup
        ? await post('/auth/verify', { userId: p.userId, emailCode, phoneCode })
        : await post('/auth/login/verify', { userId: p.userId, channel: p.channel, code: p.channel === 'email' ? emailCode : phoneCode });
      setUser(r.user);
      clearPending();
      navigate(signup ? '/passkey' : r.user.onboarding?.scanned ? '/app' : '/onboarding/identity');
    } catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(false); }
  };
  const resend = async () => {
    try {
      const r = signup ? await post('/auth/resend', { userId: p.userId }) : await post('/auth/login/code', { identifier: p.identifier });
      const np = { ...p, devCodes: r.devCodes };
      setP(np); savePending(np); setWait(45); toast(t('New code sent'));
    } catch (e: any) { toast(t(e.message), 'err'); }
  };

  return (
    <AuthSplit left={<>
      <div className="mt-auto flex flex-col gap-3.5">
        <h1 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-3xl">{t(signup ? 'Two quick checks.' : 'Check your code.')}</h1>
        <p className="max-w-md text-lg leading-[30px] text-onm">{t(signup ? 'Proving the email and number are yours lets us send legal requests in your name.' : 'We sent a one-time code so only you can log in.')}</p>
      </div>
      <div className="mb-auto">{signup && <SignupSteps at={2} />}</div>
    </>}>
      <div className="flex items-center justify-between gap-4">
        {signup ? <Steps steps={[t('Account'), t('Verify'), t('Passkey')]} current={1} /> : <span />}
        <Link to={signup ? '/signup' : '/login'} className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="cl" size="sm" />{t('Back')}</Link>
      </div>
      <form className="flex flex-col gap-6" onSubmit={submit}>
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl font-extrabold tracking-tight">{t(signup ? 'Enter your codes' : 'Enter your code')}</h2>
          <p className="text-mute">{t(signup ? 'We sent a 6-digit code to each. They expire in 10 minutes.' : 'We sent a 6-digit code. It expires in 10 minutes.')}</p>
        </div>
        {(p.devCodes?.email || p.devCodes?.phone) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F3DFAE] bg-[#FFF7E0] px-3.5 py-2.5 text-[13.5px] text-[#5C4400]">
            <span><b>{t('Dev mode')}:</b> {t('no email or SMS service is set up, so your codes are shown here')}: <b translate="no">{[p.devCodes.email, p.devCodes.phone].filter(Boolean).join(' · ')}</b></span>
            <Button variant="secondary" size="sm" onClick={() => { if (p.devCodes?.email) setEmailCode(p.devCodes.email); if (p.devCodes?.phone) setPhoneCode(p.devCodes.phone); }}>{t('Fill')}</Button>
          </div>
        )}
        {showEmail && (
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><Icon name="mail" className="text-brand" />{t('Email code')} · <span translate="no">{p.maskedEmail || p.masked}</span></span>
            <OtpInput value={emailCode} onChange={setEmailCode} label={t('Email code')} autoFocus />
          </div>
        )}
        {showPhone && (
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><Icon name="phone" className="text-brand" />{t('SMS code')} · <span translate="no">{p.maskedPhone || p.masked}</span></span>
            <OtpInput value={phoneCode} onChange={setPhoneCode} label={t('SMS code')} autoFocus={!showEmail} />
          </div>
        )}
        <span className="text-[13px] text-mute">{t("Didn't get it?")} {wait ? t('Resend in {s} s', { s: wait }) : <LinkButton onClick={resend}>{t('Resend code')}</LinkButton>}</span>
        {err && <span className="text-sm text-leak" role="alert">{err}</span>}
        <Button type="submit" size="lg" full loading={busy}>{t('Verify and continue')}<Icon name="ar" /></Button>
      </form>
    </AuthSplit>
  );
}
