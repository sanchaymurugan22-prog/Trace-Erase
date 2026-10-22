import { useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { useApi } from '@/hooks/useApi';
import { del, post } from '@/lib/api';
import { agoParts, fmtDate } from '@/lib/format';
import { createPasskey, passkeyErrorMessage, passkeysSupported } from '@/lib/webauthn';
import { ActionButton, Icon, Tile, useToast } from '@/components/ui';
import { SettingRow, SettingsCard } from './SettingsCard';

interface Passkey { id: string; label: string; createdAt: string; lastUsed?: string }

export function SecuritySection() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { logout, refresh } = useSession();
  const { data: passkeys, reload } = useApi<Passkey[]>('/passkeys');

  const add = async () => {
    try {
      const o = await post('/auth/passkey/register/options');
      const c = await createPasskey(o);
      await post('/auth/passkey/register/verify', { credential: c, label: 'Passkey on this device' });
      reload(); refresh(); toast(t('Passkey added'));
    } catch (e: any) { throw new Error(e.name ? passkeyErrorMessage(e) : e.message); }
  };

  return (
    <SettingsCard id="security" title={t('Security')} description={t('Passkeys sign your deletion requests, so nobody can send one in your name.')}>
      <div className="flex flex-col">
        {(passkeys || []).map(p => {
          const [tpl, n] = agoParts(p.lastUsed);
          return (
            <SettingRow key={p.id} title={<span className="flex items-center gap-3"><Tile icon="finger" tone="accent" size="sm" />{t(p.label)}</span>}
              sub={`${t('Added {date}', { date: fmtDate(p.createdAt) })}${p.lastUsed ? ` · ${t('Last used')} ${t(tpl, { n }).toLowerCase()}` : ''}`}>
              <ActionButton variant="ghost" size="sm" onClick={async () => { await del('/passkeys/' + p.id); reload(); refresh(); }}>{t('Remove')}</ActionButton>
            </SettingRow>
          );
        })}
        {!passkeys?.length && <span className="py-2 text-sm text-mute">{t('No passkeys yet. Requests are signed with your account until you add one.')}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {passkeysSupported() && <ActionButton variant="secondary" size="sm" onClick={add}><Icon name="plus" size="sm" />{t('Add a passkey')}</ActionButton>}
        <ActionButton variant="ghost" size="sm" onClick={async () => { await logout(); navigate('/login'); }}><Icon name="logout" size="sm" />{t('Log out')}</ActionButton>
      </div>
    </SettingsCard>
  );
}
