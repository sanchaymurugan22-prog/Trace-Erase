// Onboarding step 3: the AI scan, live.
import { useEffect, useState } from 'react';
import { useNavigate, useQuery } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { get } from '@/lib/api';
import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Button, CompanyAvatar, ErrorBox, Icon, Spinner } from '@/components/ui';

export default function ScanPage() {
  const q = useQuery();
  const navigate = useNavigate();
  const t = useT();
  const [scan, setScan] = useState<any>(null);
  const [err, setErr] = useState<any>(null);

  useEffect(() => {
    let alive = true, timer: number | undefined;
    const tick = async () => {
      try {
        const s = q.id ? await get('/scan/' + q.id) : await get('/scan/latest');
        if (!alive) return;
        if (!s) { navigate('/onboarding/connect', { replace: true }); return; }
        setScan(s);
        if (s.status === 'running') timer = window.setTimeout(tick, 700);
      } catch (e) { if (alive) setErr(e); }
    };
    tick();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [q.id, navigate]);

  const pct = scan?.progress || 0;
  const done = scan?.status === 'done';
  return (
    <div className="dots min-h-screen bg-navy text-on">
      <OnboardingHeader step="scan" dark />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-9 px-10 py-12 max-[820px]:px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-accent-b"><Icon name="sparkle" size="sm" />{t('Discovery agent at work')}</span>
          <h1 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-3xl">{t(done ? 'Scan complete' : 'Finding everyone who has your data')}</h1>
        </div>
        <ErrorBox error={err || (scan?.status === 'failed' && { message: scan.error })} />
        <div className="grid grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)] items-center gap-11 max-[1100px]:grid-cols-1">
          <div className="rounded-[22px] border border-white/8 bg-navy2 p-6">
            <span className="text-xs font-bold uppercase tracking-[.08em] text-onm">{t('Sources')}</span>
            {(scan?.sources || []).map((s: any) => (
              <div key={s.key} className="flex items-center gap-3 border-b border-white/7 py-3.5 last:border-b-0">
                <span className={`inline-flex size-9 items-center justify-center rounded-[10px] ${s.state === 'done' ? 'bg-accent-b/14 text-accent-b' : 'bg-white/8 text-white'}`}>
                  {s.state === 'done' ? <Icon name="check" size="sm" /> : s.state === 'running' ? <Spinner className="size-3.5" /> : <Icon name="clock" size="sm" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{t(s.label)}</span><span className="text-[13px] text-onm">{t(s.detail || (s.state === 'waiting' ? 'Waiting' : 'Working…'))}</span></span>
              </div>
            ))}
          </div>
          <div className="mx-auto grid size-[340px] place-items-center rounded-full shadow-[0_0_0_18px_rgba(45,212,191,.05),0_0_0_36px_rgba(45,212,191,.03)]"
            style={{ background: `conic-gradient(#2DD4BF 0 ${pct}%, rgba(255,255,255,.08) ${pct}% 100%)` }} role="img" aria-label={t('{pct}% done, {n} companies found', { pct, n: scan?.found || 0 })}>
            <div className="flex size-[296px] flex-col items-center justify-center gap-1 rounded-full bg-navy">
              <span className="font-display text-[88px] font-extrabold leading-none tracking-tight text-white">{scan?.found || 0}</span>
              <span className="text-onm">{t('companies found')}</span>
              <span className="mt-2.5 rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-semibold">{t('{pct}% done', { pct })}</span>
            </div>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-navy2 p-6">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.08em] text-onm">{t('Just found')}</span>{!done && <span className="flex items-center gap-1.5 text-[13px] text-accent-b"><span className="size-2 rounded-full bg-accent-b" />{t('Live')}</span>}</div>
            {(scan?.justFound || []).map((c: any, i: number) => (
              <div key={c.name + i} className="flex animate-fade items-center gap-3 border-b border-white/7 py-3 last:border-b-0"><CompanyAvatar company={c} size="sm" /><span className="flex flex-col"><span className="font-semibold" translate="no">{c.name}</span><span className="text-[13px] text-onm">{t(c.category)}</span></span></div>
            ))}
            {!scan?.justFound?.length && <span className="block pt-3 text-[13px] text-onm">{t('Companies appear here as AI finds them.')}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-7">
          <span className="flex items-center gap-2 text-sm text-onm"><Icon name="lock" size="sm" className="text-accent-b" />{t('Your name, email and number are masked before any AI sees them.')}</span>
          <Button variant="white" size="lg" disabled={!done} onClick={() => navigate('/onboarding/results')}>{done ? t('See results') : <><Spinner />{t('Scanning')}</>}<Icon name="ar" /></Button>
        </div>
      </main>
    </div>
  );
}
