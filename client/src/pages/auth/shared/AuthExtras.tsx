// Pieces shared by the sign-up and log-in screens.
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useI18n } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { Button, Icon } from '@/components/ui';

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <Button type="button" variant="secondary" size="lg" full onClick={onClick} disabled={disabled}>
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full border border-line2 text-[13px] font-extrabold text-brand">G</span>
      {t('Continue with Google')}
    </Button>
  );
}

export function OrLine({ text }: { text?: string }) {
  const { t } = useI18n();
  return <div className="flex items-center gap-3 text-[13px] text-mute before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">{t(text || 'or')}</div>;
}

/** "Try the demo": a separate demo account with sample data and demo controls. Never touches real companies. */
export function DemoButton() {
  const { flags, setUser } = useSession();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!flags.demoMode) return null;
  const start = async () => {
    setBusy(true); setErr('');
    try {
      const r = await post('/demo/start', { language: lang });
      setUser(r.user);
      navigate('/onboarding/identity');
    } catch (e: any) { setErr(t(e.message)); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-soft px-4 py-3 text-center">
      <span className="text-sm text-ink2">{t('Just looking? Try TraceErase with sample data. Nothing is sent to real companies.')}</span>
      <Button type="button" variant="ghost" size="sm" loading={busy} onClick={start}><Icon name="play" size="sm" />{t('Try the demo')}</Button>
      {err && <span className="text-sm text-leak" role="alert">{err}</span>}
    </div>
  );
}
