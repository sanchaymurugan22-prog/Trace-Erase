import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { post } from '@/lib/api';
import { copyText } from '@/lib/format';
import { ActionButton, Button, Icon, useToast } from '@/components/ui';
import { SettingsCard } from './SettingsCard';

export function ExtensionSection() {
  const t = useT();
  const toast = useToast();
  const [code, setCode] = useState('');
  const steps = [
    t('In Chrome, open chrome://extensions and turn on Developer mode.'),
    t('Click "Load unpacked" and choose the extension folder inside TraceErase.'),
    t('Open the extension, paste the connection code below, and save.')
  ];
  return (
    <SettingsCard id="extension" title={t('Browser extension')} description={t('Fills your protected email and number on sign-up forms and warns you about the site’s privacy policy.')}>
      <ol className="m-0 flex flex-col gap-2 pl-5 text-sm text-ink2">{steps.map(s => <li key={s}>{s}</li>)}</ol>
      <div className="flex flex-wrap items-center gap-2">
        {code ? (
          <>
            <code className="min-w-0 max-w-[520px] flex-1 truncate rounded-xl bg-soft px-3 py-2.5 font-mono text-[13px]" translate="no">{code}</code>
            <Button variant="secondary" size="sm" onClick={() => copyText(code, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy code')}</Button>
          </>
        ) : (
          <ActionButton variant="secondary" onClick={async () => setCode((await post<{ token: string }>('/ext/token')).token)}><Icon name="key" />{t('Create connection code')}</ActionButton>
        )}
      </div>
      <span className="text-[13px] text-mute">{t('The code works like a login. Keep it private.')}</span>
    </SettingsCard>
  );
}
