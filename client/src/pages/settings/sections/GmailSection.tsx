import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { get } from '@/lib/api';
import { Button, ButtonLink, Chip, Icon, useToast } from '@/components/ui';
import { GmailSetupDialog } from '@/pages/onboarding/connect/GmailSetupDialog';
import { SettingRow, SettingsCard } from './SettingsCard';

export function GmailSection() {
  const t = useT();
  const toast = useToast();
  const { user, flags, refresh } = useSession();
  const [dialog, setDialog] = useState(false);
  const connect = async () => {
    try { const r = await get<{ url: string }>('/gmail/auth-url'); window.location.href = r.url; } catch (e: any) { toast(t(e.message), 'err'); }
  };
  return (
    <SettingsCard id="gmail" title={t('Gmail scanning')} description={t('Optional. Lets the AI scan your real inbox (sender and subject only) instead of the sample inbox.')}>
      <SettingRow title="Gmail" sub={user?.gmailConnected ? t('Connected. Scan again any time from the dashboard.') : flags.gmailConfigured ? t('Set up. Connect your account to scan it.') : t('Needs a Google OAuth client, about 5 minutes once.')}>
        {user?.gmailConnected ? <Chip tone="ok" icon="check">{t('Connected')}</Chip>
          : flags.gmailConfigured ? <Button size="sm" onClick={connect}><Icon name="link" size="sm" />{t('Connect Gmail')}</Button>
          : <Button size="sm" variant="secondary" onClick={() => setDialog(true)}><Icon name="settings" size="sm" />{t('Set up Gmail')}</Button>}
      </SettingRow>
      {user?.gmailConnected && <ButtonLink to="/onboarding/connect" variant="secondary" size="sm" className="self-start"><Icon name="sparkle" size="sm" />{t('Scan again')}</ButtonLink>}
      {dialog && <GmailSetupDialog onClose={() => setDialog(false)} onSaved={() => { setDialog(false); refresh(); }} />}
    </SettingsCard>
  );
}
