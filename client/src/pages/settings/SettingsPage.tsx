// Settings: one page, sections listed on the left. Each section lives in its own file in ./sections.
import { useEffect } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { AppShell } from '@/components/layout/AppShell';
import { Banner, ButtonLink, Icon, type IconName } from '@/components/ui';
import { ProfileSection } from './sections/ProfileSection';
import { IdentitySection } from './sections/IdentitySection';
import { AutomationSection } from './sections/AutomationSection';
import { AiSection } from './sections/AiSection';
import { GmailSection } from './sections/GmailSection';
import { DisplaySection } from './sections/DisplaySection';
import { ExtensionSection } from './sections/ExtensionSection';
import { SecuritySection } from './sections/SecuritySection';
import { DataSection } from './sections/DataSection';

const SECTIONS: [string, IconName, string][] = [
  ['profile', 'user', 'Profile'],
  ['identity', 'shield', 'Protected identity'],
  ['automation', 'zap', 'Automation'],
  ['ai', 'sparkle', 'AI (Gemini)'],
  ['gmail', 'mail', 'Gmail scanning'],
  ['display', 'globe', 'Language and display'],
  ['extension', 'ext', 'Browser extension'],
  ['security', 'key', 'Security'],
  ['data', 'trash', 'Your TraceErase data']
];

export default function SettingsPage() {
  const t = useT();
  const { flags } = useSession();
  useEffect(() => {
    if (window.location.hash) window.setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  return (
    <AppShell>
      <h1 className="text-4xl font-extrabold tracking-tight">{t('Settings')}</h1>
      <div className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="flex flex-col gap-0.5 lg:sticky lg:top-6" aria-label={t('Settings sections')}>
          {SECTIONS.map(([id, icon, label]) => (
            <a key={id} href={`#${id}`} className="flex h-[42px] items-center gap-2.5 rounded-[10px] px-3 text-sm font-semibold text-ink2 hover:bg-soft hover:text-ink">
              <Icon name={icon} size="sm" />{t(label)}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-6">
          <ProfileSection />
          <IdentitySection />
          <AutomationSection />
          <AiSection />
          <GmailSection />
          <DisplaySection />
          <ExtensionSection />
          <SecuritySection />
          <DataSection />
          {flags.devMail && (
            <Banner tone="info" icon="mail">
              <span className="flex-1 text-sm">{t('No email service is set up, so outgoing emails and SMS are shown in the Dev outbox.')}</span>
              <ButtonLink to="/app/outbox" variant="secondary" size="sm">{t('Open outbox')}</ButtonLink>
            </Banner>
          )}
        </div>
      </div>
    </AppShell>
  );
}
