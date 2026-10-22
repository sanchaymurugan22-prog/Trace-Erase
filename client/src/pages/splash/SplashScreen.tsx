// Screen 1: Splash. Shows for exactly 3 seconds, then opens the Language screen.
import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { Icon, LogoMark, ProgressBar } from '@/components/ui';

const DURATION = 3000;

export default function SplashScreen() {
  const navigate = useNavigate();
  const t = useT();
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(100, ((now - start) / DURATION) * 100);
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = window.setTimeout(() => navigate('/language', { replace: true }), DURATION);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [navigate]);

  return (
    <main className="dots relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy p-6 text-on">
      <span className="absolute size-[560px] rounded-full border border-accent-b/15" />
      <span className="absolute size-[820px] rounded-full border border-white/6" />
      <div className="relative flex animate-fade flex-col items-center gap-6">
        <LogoMark size={120} />
        <span className="font-display text-7xl font-extrabold tracking-tight text-white max-[640px]:text-5xl" translate="no">Trace<span className="text-accent-b">Erase</span></span>
        <span className="text-lg text-onm">{t('Find it. Delete it. Prove it.')}</span>
      </div>
      <div className="relative mt-16 flex w-72 flex-col items-center gap-3">
        <ProgressBar pct={pct} dark color="#2DD4BF" className="h-1" />
        <span className="text-[13px] text-onm">{t('Securing your session')}</span>
      </div>
      <div className="absolute bottom-8 flex flex-wrap justify-center gap-5 text-[13px] text-[#7F8DA8]">
        <span className="flex items-center gap-1.5"><Icon name="lock" size="sm" />{t('Passkey-signed requests')}</span>
        <span className="flex items-center gap-1.5"><Icon name="hash" size="sm" />{t('Tamper-proof receipts')}</span>
        <span className="flex items-center gap-1.5"><Icon name="scale" size="sm" />{t('Built on the DPDP Act 2023')}</span>
      </div>
    </main>
  );
}
