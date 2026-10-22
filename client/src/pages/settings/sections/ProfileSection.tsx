import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { fmtDate, initials } from '@/lib/format';
import { ActionButton, Input, Well, useToast } from '@/components/ui';
import { SettingsCard } from './SettingsCard';

export function ProfileSection() {
  const t = useT();
  const toast = useToast();
  const { user, updateMe } = useSession();
  const [name, setName] = useState(user?.name || '');
  if (!user) return null;
  return (
    <SettingsCard id="profile" title={t('Profile')}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex size-16 flex-none items-center justify-center rounded-full bg-brand font-display text-[22px] font-bold text-white" translate="no">{initials(user.name)}</span>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <Input value={name} onChange={e => setName(e.target.value)} aria-label={t('Name')} className="max-w-[360px]" />
          <span className="text-sm text-mute">{t('Member since {date}', { date: fmtDate(user.createdAt, { year: true }) })}</span>
        </div>
        <ActionButton variant="secondary" size="sm" disabled={!name.trim() || name === user.name} onClick={async () => { await updateMe({ name }); toast(t('Saved')); }}>{t('Save')}</ActionButton>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Well className="gap-0.5"><span className="text-[13px] text-mute">{t('Real email · private')}</span><span className="font-semibold" translate="no">{user.email}</span></Well>
        <Well className="gap-0.5"><span className="text-[13px] text-mute">{t('Real number · private')}</span><span className="font-semibold" translate="no">{user.phone}</span></Well>
      </div>
    </SettingsCard>
  );
}
