import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { useApi } from '@/hooks/useApi';
import { copyText } from '@/lib/format';
import { Button, ButtonLink, Icon, Tile, useToast } from '@/components/ui';
import type { Address } from '@/types/api';
import { SettingRow, SettingsCard } from './SettingsCard';

export function IdentitySection() {
  const t = useT();
  const toast = useToast();
  const { user } = useSession();
  const { data } = useApi<{ addresses: Address[] }>('/identity');
  const active = (data?.addresses || []).filter(a => a.status === 'active' && a.purpose !== 'replies');
  const leaks = (data?.addresses || []).reduce((n, a) => n + (a.leaks || 0), 0);
  return (
    <SettingsCard id="identity" title={t('Protected identity')} description={t('Give apps these instead of your real email and number.')}>
      <div className="flex flex-col">
        <SettingRow title={<span className="flex items-center gap-3"><Tile icon="phone" size="sm" />{t('Protected number')}</span>} sub={user?.protectedNumber ? <span className="font-mono" translate="no">{user.protectedNumber}</span> : <span>{t('Not available yet: phone protection needs a paid phone service.')}</span>}>
          {user?.protectedNumber && <Button variant="secondary" size="sm" onClick={() => copyText(user?.protectedNumber || '', (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button>}
        </SettingRow>
        <SettingRow title={<span className="flex items-center gap-3"><Tile icon="mail" size="sm" />{t('Protected emails')}</span>}
          sub={data ? t('{n} active · {leaks} leaks caught', { n: active.length, leaks }) : '…'}>
          <ButtonLink to="/app/protect" variant="secondary" size="sm">{t('Manage')}</ButtonLink>
        </SettingRow>
      </div>
    </SettingsCard>
  );
}
