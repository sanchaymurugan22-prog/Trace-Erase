// Screen: Confirm your email (Firebase sends a link; we check it when the person comes back).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useQuery } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { checkEmailConfirmed, pendingEmail, resendConfirmation } from '@/lib/firebaseAuth';
import { AuthSplit } from '@/components/layout/AuthSplit';
import { Banner, Button, Icon, Steps, useToast } from '@/components/ui';
import { SignupSteps } from '../shared/SignupSteps';

export default function CheckEmailPage() {
  const navigate = useNavigate();
  const q = useQuery();
  const { user, setUser, logout } = useSession();
  const t = useT();
  const toast = useToast();
  const pending = pendingEmail();
  const email = pending?.email || user?.email || '';
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(30);
  useEffect(() => { const i = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000); return () => clearInterval(i); }, []);

  const check = async (quiet = false) => {
    setBusy('check'); if (!quiet) setErr('');
    try {
      const u = await checkEmailConfirmed();
      setUser(u);
      if (u.verified) { navigate(u.hasPasskey ? '/onboarding/identity' : '/passkey'); return; }
      if (!quiet) setErr(t("We don't see the confirmation yet. Open the link in the email, then press Continue."));
    } catch (e: any) { if (!quiet) setErr(t(e.message)); } finally { setBusy(''); }
  };
  // Coming back from the link in the email (same browser), or when the tab regains focus
  useEffect(() => {
    if (q.confirmed && pending) check(true);
    const onFocus = () => { if (pendingEmail()) check(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resend = async () => {
    setBusy('resend'); setErr('');
    try { await resendConfirmation(); setWait(30); toast(t('Email sent again')); }
    catch (e: any) { setErr(t(e.message)); } finally { setBusy(''); }
  };

  return (
    <AuthSplit left={<><div className="mt-6"><SignupSteps at={2} /></div></>}>
      <Steps steps={[t('Account'), t('Verify'), t('Passkey')]} current={1} />
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl font-extrabold tracking-tight">{t('Confirm your email')}</h2>
          <p className="text-mute">{t('We sent a link to {email}. Open it, then come back here.', { email })}</p>
        </div>
        {q.confirmed && !pending && (
          <Banner tone="ok" icon="check"><span className="text-sm">{t('Email confirmed. Please log in to continue.')}</span></Banner>
        )}
        <Banner tone="info" icon="mail"><span className="text-sm">{t("Can't find it? Check your Spam and Promotions folders.")}</span></Banner>
        {err && <span className="text-sm text-leak" role="alert">{err}</span>}
        {pending ? (
          <>
            <Button size="lg" full loading={busy === 'check'} disabled={!!busy} onClick={() => check()}>{t('Continue')}<Icon name="ar" /></Button>
            <Button variant="secondary" full loading={busy === 'resend'} disabled={!!busy || wait > 0} onClick={resend}>{wait > 0 ? t('Send again in {n}s', { n: wait }) : t('Send the email again')}</Button>
          </>
        ) : (
          <Button size="lg" full onClick={() => navigate('/login')}>{t('Log in')}<Icon name="ar" /></Button>
        )}
        <span className="text-center text-sm text-mute">{t('Wrong email?')} <Link to="/signup" onClick={() => { if (user) logout(); }} className="font-semibold">{t('Start again')}</Link></span>
      </div>
    </AuthSplit>
  );
}
