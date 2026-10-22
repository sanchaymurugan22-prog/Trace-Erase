import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { del, downloadApi } from '@/lib/api';
import { ActionButton, Button, Icon, Modal, buttonClass } from '@/components/ui';
import { SettingRow, SettingsCard } from './SettingsCard';

export function DataSection() {
  const t = useT();
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [confirm, setConfirm] = useState(false);
  return (
    <SettingsCard id="data" title={t('Your TraceErase data')} danger>
      <div className="flex flex-col">
        <SettingRow title={t('Download everything we hold')} sub={t('Receipts, requests and logs, in one file')}>
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => downloadApi('/api/me/export', 'traceerase-my-data.json').catch(() => {})}><Icon name="download" size="sm" />{t('Export')}</button>
        </SettingRow>
        <SettingRow title={<span className="text-leak">{t('Delete my TraceErase account')}</span>} sub={t("We practise what we preach: you'll get our own signed deletion receipt.")}>
          <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>{t('Delete account')}</Button>
        </SettingRow>
      </div>
      {confirm && (
        <Modal label={t('Delete account')} onClose={() => setConfirm(false)}>
          <h2 className="pr-8 text-2xl font-bold">{t('Delete your TraceErase account?')}</h2>
          <p className="text-mute">{t('Your protected addresses stop working and all your requests, messages and chats are deleted. Anonymous receipt fingerprints stay so the public ledger remains verifiable. This cannot be undone.')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>{t('Cancel')}</Button>
            <ActionButton variant="danger" onClick={async () => { const r = await del<{ receiptId: string }>('/me'); await refresh(); navigate(`/verify/${r.receiptId}`); }}>{t('Delete everything')}</ActionButton>
          </div>
        </Modal>
      )}
    </SettingsCard>
  );
}
