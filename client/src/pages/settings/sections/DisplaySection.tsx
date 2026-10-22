import { useI18n } from '@/i18n/I18nProvider';
import { LANGUAGES } from '@/i18n/languages';
import { useSession } from '@/lib/session';
import { Segmented, Select, useToast } from '@/components/ui';
import { SettingRow, SettingsCard } from './SettingsCard';

export function DisplaySection() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, updateMe, setLanguage } = useSession();
  const s = user?.settings;
  if (!user || !s) return null;
  const save = (settings: Record<string, any>) => updateMe({ settings }).then(() => toast(t('Saved')));
  return (
    <SettingsCard id="display" title={t('Language and display')}>
      <div className="flex flex-col">
        <SettingRow title={t('App language')} sub={t('Every screen changes right away.')} htmlFor="set-lang">
          <Select id="set-lang" className="h-11 w-60" value={lang} onChange={e => setLanguage(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.native} · {l.english}</option>)}
          </Select>
        </SettingRow>
        <SettingRow title={t('Letters to companies')} sub={t('The language AI writes your deletion requests in.')} htmlFor="set-letter">
          <Select id="set-letter" className="h-11 w-60" value={(user as any).letterLanguage || 'en'} onChange={e => updateMe({ letterLanguage: e.target.value }).then(() => toast(t('Saved')))}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.english}</option>)}
          </Select>
        </SettingRow>
        <SettingRow title={t('Text size')}>
          <Segmented value={s.textSize || 'default'} onChange={v => save({ textSize: v })}
            options={[{ value: 'small', label: t('Small') }, { value: 'default', label: t('Default') }, { value: 'large', label: t('Large') }]} />
        </SettingRow>
        <SettingRow title={t('Theme')}>
          <Segmented value={s.theme || 'light'} onChange={v => save({ theme: v })}
            options={[{ value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }, { value: 'system', label: t('System') }]} />
        </SettingRow>
      </div>
    </SettingsCard>
  );
}
