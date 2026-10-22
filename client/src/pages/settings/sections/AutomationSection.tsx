import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { Toggle, useToast } from '@/components/ui';
import { SettingRow, SettingsCard } from './SettingsCard';

const OPTIONS: [string, string, string][] = [
  ['autoOtp', 'Fill verification codes for my deletion requests', 'Only for requests you signed. Never for logins or payments.'],
  ['autoEscalate', 'Send reminders and grievances automatically', 'A reminder on day 7 and a formal grievance on day 10'],
  ['autoFile', 'File complaints automatically', 'When a company ignores everything, file the complaint in your name without asking first'],
  ['strictMode', 'Strict mode', "Block every sender that is not on an app's allowed list"]
];

export function AutomationSection() {
  const t = useT();
  const toast = useToast();
  const { user, updateMe } = useSession();
  const s = user?.settings;
  if (!s) return null;
  return (
    <SettingsCard id="automation" title={t('Automation')} description={t('What TraceErase may do for you without asking each time.')}>
      <div className="flex flex-col">
        {OPTIONS.map(([key, title, sub]) => (
          <SettingRow key={key} title={t(title)} sub={t(sub)} htmlFor={'auto-' + key}>
            <Toggle id={'auto-' + key} checked={!!(s as any)[key]} onChange={e => updateMe({ settings: { [key]: e.target.checked } }).then(() => toast(t('Saved')))} />
          </SettingRow>
        ))}
      </div>
    </SettingsCard>
  );
}
