// Screen: Regulator log-in (email + password). Only regulators can open the regulator console.
import { useState } from 'react';
import { Link, useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { AuthSplit } from '@/components/layout/AuthSplit';
import { Button, Field, Icon, Input, Tile, type IconName } from '@/components/ui';

export default function RegulatorLoginPage() {
  const navigate = useNavigate();
  const { setStaff, flags } = useSession();
  const t = useT();
  const [f, setF] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await post('/auth/staff/login', f);
      setStaff(r.staff);
      navigate('/regulator');
    } catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(false); }
  };
  const points: [IconName, string][] = [['file', 'Every complaint arrives with a fingerprinted evidence pack'], ['sparkle', 'AI groups complaints and highlights repeat offenders'], ['shieldc', 'Any receipt can be checked against the ledger']];
  return (
    <AuthSplit left={<>
      <div className="mt-auto flex flex-col gap-3.5">
        <span className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-white/10 px-3 text-[13px] font-semibold"><Icon name="scale" size="sm" className="text-accent-b" />{t('Data Protection Board')}</span>
        <h1 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-3xl">{t('Regulator console')}</h1>
        <p className="max-w-md text-lg leading-[30px] text-onm">{t('Review complaints filed by TraceErase users, with the evidence behind each one.')}</p>
      </div>
      <div className="mb-auto flex max-w-[460px] flex-col rounded-3xl border border-white/10 bg-navy2 p-6">
        {points.map(([ic, s]) => <div key={s} className="flex items-center gap-3 border-b border-white/8 py-3 text-on last:border-b-0"><Tile icon={ic} tone="dark" size="sm" /><span className="text-sm">{t(s)}</span></div>)}
      </div>
    </>}>
      <div className="flex justify-end"><Link to="/login" className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="cl" size="sm" />{t('User log-in')}</Link></div>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <div className="flex flex-col gap-2"><h2 className="text-4xl font-extrabold tracking-tight">{t('Regulator log-in')}</h2><p className="text-mute">{t('For Data Protection Board officers only.')}</p></div>
        <Field label={t('Official email')} htmlFor="rem"><Input id="rem" type="email" required autoComplete="username" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={t('Password')} htmlFor="rpw">
          <div className="relative">
            <Input id="rpw" type={show ? 'text' : 'password'} required autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} className="pr-12" />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={t(show ? 'Hide password' : 'Show password')} className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-mute hover:bg-soft"><Icon name="eye" size="sm" /></button>
          </div>
        </Field>
        {err && <span className="text-sm text-leak" role="alert">{err}</span>}
        <Button type="submit" size="lg" full loading={busy}><Icon name="login" />{t('Log in')}</Button>
        {flags.demoMode && (
          <div className="flex flex-col gap-1 rounded-xl border border-[#F3DFAE] bg-[#FFF7E0] px-4 py-3 text-[13px] text-[#5C4400]">
            <b>{t('Demo regulator accounts')}</b>
            <span translate="no">regulator@traceerase.demo · Regulator@2026</span>
            <span translate="no">board.officer@traceerase.demo · Board@2026</span>
            <span>{t('Change them with REGULATOR_ACCOUNTS in server/.env.')}</span>
          </div>
        )}
      </form>
    </AuthSplit>
  );
}
