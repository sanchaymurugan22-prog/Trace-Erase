// Onboarding step 2: choose what the AI scans (Gmail, the sample inbox, or an uploaded list).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useQuery } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { get, post } from '@/lib/api';
import { cn } from '@/lib/format';
import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Button, ButtonLink, Card, Chip, Icon, Tile, useToast } from '@/components/ui';
import { GmailSetupDialog } from './GmailSetupDialog';
import { ExtensionHelpDialog } from './ExtensionHelpDialog';
import { UploadMailList } from './UploadMailList';
import type { MailRow } from './parseUpload';
import { gmailAccessToken, googleEnabled, preloadGoogle } from '@/lib/firebaseAuth';
import { GMAIL_SCAN } from '@/lib/config';

type Source = 'gmail' | 'sample' | 'upload';

function Option({ selected, onSelect, children, disabled }: { selected: boolean; onSelect?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Card className={cn('flex-row items-start gap-[18px] p-6 transition', selected && 'border-[#9FB4F3] ring-[3px] ring-brand/10', onSelect && !disabled && 'cursor-pointer hover:border-line2')}
      onClick={() => { if (!disabled) onSelect?.(); }}>
      {children}
    </Card>
  );
}

const Radio = ({ on }: { on: boolean }) => <span className={cn('mt-1 size-5 flex-none rounded-full border-[1.5px]', on ? 'border-[6px] border-brand' : 'border-line2')} aria-hidden="true" />;

const GmailLogo = () => (
  <span className="inline-flex size-14 flex-none items-center justify-center rounded-2xl bg-[#FDECEA]">
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5V18a1 1 0 0 0 1 1h3V10l5 3.8L17 10v9h3a1 1 0 0 0 1-1V6.5l-2-1.3-7 5.2-7-5.2z" fill="#D93025" /></svg>
  </span>
);

export default function ConnectPage() {
  const { user, flags, refresh } = useSession();
  const navigate = useNavigate();
  const q = useQuery();
  const t = useT();
  const toast = useToast();
  const isDemo = !!user?.demo;
  // Online: Gmail is read with a one-time Google permission in the browser (nothing is stored)
  const browserGmail = GMAIL_SCAN && googleEnabled() && !isDemo;
  // Online without direct Gmail access: people upload a mail export instead
  const showGmail = GMAIL_SCAN || !!user?.gmailConnected;
  const gmailReady = !isDemo && (browserGmail || !!user?.gmailConnected);
  const [source, setSource] = useState<Source>(isDemo ? 'sample' : gmailReady ? 'gmail' : 'upload');
  useEffect(() => { if (browserGmail) preloadGoogle(); }, [browserGmail]);
  const [upload, setUpload] = useState<{ name: string; rows: MailRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'' | 'gmail' | 'ext'>('');

  useEffect(() => {
    if (q.gmail === 'connected') { refresh(); setSource('gmail'); toast(t('Gmail connected')); }
    if (q.gmail === 'error') toast(t('Gmail could not connect: {reason}', { reason: q.reason || '' }), 'err');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectGmail = async () => {
    try { const r = await get('/gmail/auth-url'); window.location.href = r.url; } catch (e: any) { toast(t(e.message), 'err'); }
  };
  const start = async () => {
    setBusy(true);
    try {
      const accessToken = source === 'gmail' && browserGmail ? await gmailAccessToken(user?.email) : undefined;
      const scan = await post('/scan', { source, accessToken, messages: source === 'upload' ? upload?.rows : undefined });
      navigate('/onboarding/scan?id=' + scan.id);
    } catch (e: any) { toast(t(e.message), 'err'); setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-bg">
      <OnboardingHeader step="connect" />
      <main className="mx-auto flex max-w-[1120px] flex-col gap-7 px-10 py-12 max-[820px]:px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight max-[820px]:text-3xl">{t('Connect what AI should scan')}</h1>
          <p className="max-w-[640px] text-lg text-mute">{t('The more you connect, the more companies we can find. You can disconnect anything, anytime.')}</p>
        </div>

        <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
          {/* Gmail */}
          {showGmail && <Option selected={source === 'gmail'} onSelect={gmailReady ? () => setSource('gmail') : undefined} disabled={isDemo}>
            <GmailLogo />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-bold">Gmail</span>
                {isDemo ? <Chip>{t('Not in the demo')}</Chip>
                  : browserGmail ? <Radio on={source === 'gmail'} />
                  : user?.gmailConnected ? <Chip tone="ok" icon="check">{t('Connected')}</Chip>
                  : flags.gmailConfigured ? <Chip tone="brand">{t('Ready to connect')}</Chip> : <Chip>{t('Not set up yet')}</Chip>}
              </div>
              <p className="text-sm text-mute">{t('Read-only metadata. AI looks at who emailed you and the subject line, never your message bodies.')}</p>
              {isDemo ? <span className="text-sm text-mute">{t('Demo accounts use the sample inbox. Create a real account to scan your own Gmail.')}</span>
                : browserGmail ? <span className="text-sm text-ink2">{t('When you start, Google asks you to allow read-only access. It is used once for this scan and not stored.')}</span>
                : user?.gmailConnected
                ? <span className="flex items-center gap-2 text-sm"><Radio on={source === 'gmail'} />{t('Scan my Gmail')}</span>
                : flags.gmailConfigured
                  ? <Button size="sm" className="self-start" onClick={connectGmail}><Icon name="link" size="sm" />{t('Connect Gmail')}</Button>
                  : <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDialog('gmail')}><Icon name="settings" size="sm" />{t('Set up Gmail')}</Button>
                      <span className="text-xs text-mute">{t('About 5 minutes, once')}</span>
                    </div>}
            </div>
          </Option>}

          {/* Sample inbox (demo accounts only: it is pretend data) */}
          {isDemo && <Option selected={source === 'sample'} onSelect={() => setSource('sample')}>
            <Tile icon="inbox" tone="accent" size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2"><span className="text-xl font-bold">{t('Sample inbox')}</span><Radio on={source === 'sample'} /></div>
              <p className="text-sm text-mute">{t('43 realistic senders (Zomato, Myntra, MakeMyTrip and more) plus sample Google sign-ins. Best for demos.')}</p>
            </div>
          </Option>}

          {/* Upload */}
          <Option selected={source === 'upload'} onSelect={upload ? () => setSource('upload') : undefined}>
            <Tile icon="upload" size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center justify-between gap-2"><span className="text-xl font-bold">{t('Upload your mail list')}</span>{upload && <Radio on={source === 'upload'} />}</div>
              <p className="text-sm text-mute">{t('No Gmail connection needed: export your mail from Google Takeout (or any CSV of senders). It is read in your browser.')}</p>
              <div onClick={e => e.stopPropagation()}>
                <UploadMailList value={upload} onChange={v => { setUpload(v); if (v) { setSource('upload'); toast(t('{n} emails read from {file}', { n: v.rows.length, file: v.name })); } else if (source === 'upload') setSource(isDemo ? 'sample' : 'gmail'); }} />
              </div>
            </div>
          </Option>

          {/* Extension */}
          <Option selected={false}>
            <Tile icon="ext" size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2"><span className="text-xl font-bold">{t('Browser extension')}</span><Button variant="secondary" size="sm" onClick={() => setDialog('ext')}>{t('How to install')}</Button></div>
              <p className="text-sm text-mute">{t('Fills your protected email and number on any sign-up form, and warns you about the site’s privacy policy.')}</p>
            </div>
          </Option>
        </div>

        <Card className="flex-row flex-wrap gap-0 overflow-hidden p-0">
          <div className="flex min-w-[260px] flex-1 flex-col gap-3 p-7"><span className="flex items-center gap-2 text-[17px] font-bold"><Icon name="eye" className="text-brand" />{t('What AI reads')}</span><span className="text-sm text-ink2">{t('Sender names, sender addresses, subject lines, sign-in app names')}</span></div>
          <div className="w-px bg-line" />
          <div className="flex min-w-[260px] flex-1 flex-col gap-3 p-7"><span className="flex items-center gap-2 text-[17px] font-bold"><Icon name="ban" className="text-leak" />{t('What we never do')}</span><span className="text-sm text-ink2">{t('Read message bodies, send email as you, sell or share your data, or train AI on it')}</span></div>
        </Card>

        <div className="flex justify-between">
          <ButtonLink to="/onboarding/identity" variant="secondary" size="lg"><Icon name="cl" />{t('Back')}</ButtonLink>
          <Button size="lg" loading={busy} disabled={(source === 'upload' && !upload?.rows.length) || (source === 'gmail' && !gmailReady)} onClick={start}>{!busy && <Icon name="sparkle" />}{t('Start AI scan')}</Button>
        </div>
      </main>
      {dialog === 'gmail' && <GmailSetupDialog onClose={() => setDialog('')} onSaved={() => { setDialog(''); refresh(); }} />}
      {dialog === 'ext' && <ExtensionHelpDialog onClose={() => setDialog('')} />}
    </div>
  );
}
