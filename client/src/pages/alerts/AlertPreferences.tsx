// Which alerts the user wants, and how they want them delivered.
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { Card, Toggle, useToast } from '@/components/ui';

const TOPICS: [string, string][] = [
  ['leaks', 'Leaks'],
  ['replies', 'Company replies'],
  ['deadlines', 'Deadlines and escalations'],
  ['newCompanies', 'New companies found']
];
const CHANNELS: [string, string][] = [
  ['browser', 'In the app'],
  ['email', 'Email'],
  ['sms', 'SMS (works on weak internet)']
];

export function AlertPreferences() {
  const t = useT();
  const toast = useToast();
  const { user, updateMe } = useSession();
  const s = user?.settings;
  if (!s) return null;
  const save = (settings: Record<string, any>) => updateMe({ settings }).then(() => toast(t('Saved'))).catch((e: Error) => toast(t(e.message), 'err'));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="text-lg font-bold">{t('Alert me about')}</h2>
        <div className="flex flex-col">
          {TOPICS.map(([k, label]) => (
            <label key={k} className="flex min-h-12 items-center gap-3 border-b border-line py-2 last:border-b-0">
              <span className="flex-1 text-sm">{t(label)}</span>
              <Toggle checked={!!s.alerts?.[k]} onChange={e => save({ alerts: { ...s.alerts, [k]: e.target.checked } })} aria-label={t(label)} />
            </label>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">{t('Send alerts by')}</h2>
        <div className="flex flex-col">
          {CHANNELS.map(([k, label]) => (
            <label key={k} className="flex min-h-12 items-center gap-3 border-b border-line py-2 last:border-b-0">
              <span className="flex-1 text-sm">{t(label)}</span>
              <Toggle checked={!!s.alertChannels?.[k]} onChange={e => save({ alertChannels: { ...s.alertChannels, [k]: e.target.checked } })} aria-label={t(label)} />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
