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
import { UploadMailList } from './UploadMailList';
import type { MailRow } from './parseUpload';
import { gmailAccessToken, googleEnabled, preloadGoogle } from '@/lib/firebaseAuth';
import { GMAIL_SCAN } from '@/lib/config';

type Source = 'gmail' | 'sample' | 'upload' | 'typed';

/** "Swiggy, zomato.com, IRCTC" → rows the scan understands (a sender at each company's website). */
const typedRows = (text: string): MailRow[] => [...new Set(text.split(/[\n,;]+/).map(x => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter(x => x.length > 1))]
  .map(x => ({ from: `${x.split('.')[0]} <noreply@${x.includes('.') ? x : x.replace(/[^a-z0-9]/g, '') + '.com'}>`, subject: '', date: new Date().toISOString() }));

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
  const gmailReady = !isDemo && (browserGmail || !!user?.gmailConnected);
  const [source, setSource] = useState<Source>(isDemo ? 'sample' : gmailReady ? 'gmail' : 'typed');
  useEffect(() => { if (browserGmail) preloadGoogle(); }, [browserGmail]);
  const [upload, setUpload] = useState<{ name: string; rows: MailRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const typedList = typedRows(typed);
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
      const scan = await post('/scan', { source: source === 'typed' ? 'upload' : source, typed: source === 'typed', accessToken, messages: source === 'upload' ? upload?.rows : source === 'typed' ? typedList : undefined });
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
          {/* Gmail: real accounts scan their own Gmail; demo accounts scan a sample Gmail inbox automatically */}
          <Option selected={isDemo ? source === 'sample' : source === 'gmail'} onSelect={isDemo ? () => setSource('sample') : gmailReady ? () => setSource('gmail') : undefined}>
            <GmailLogo />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-bold">Gmail</span>
                {isDemo ? <Radio on={source === 'sample'} />
                  : browserGmail ? <Radio on={source === 'gmail'} />
                  : user?.gmailConnected ? <Chip tone="ok" icon="check">{t('Connected')}</Chip>
                  : GMAIL_SCAN && flags.gmailConfigured ? <Chip tone="brand">{t('Ready to connect')}</Chip> : <Chip>{t('Waiting for Google approval')}</Chip>}
              </div>
              <p className="text-sm text-mute">{t('Read-only metadata. AI looks at who emailed you and the subject line, never your message bodies.')}</p>
              {isDemo ? (
                <span className="flex items-start gap-2 rounded-xl bg-accent-s px-3 py-2 text-[13px] text-ink2"><Icon name="play" size="sm" className="mt-0.5 flex-none text-accent" />{t('Demo: a sample Gmail inbox (43 senders like Zomato, Myntra and MakeMyTrip, plus Google sign-ins) is connected and scanned automatically. Just press Start AI scan.')}</span>
              ) : browserGmail ? <span className="text-sm text-ink2">{t('When you start, Google asks you to allow read-only access. It is used once for this scan and not stored.')}</span>
                : user?.gmailConnected
                ? <span className="flex items-center gap-2 text-sm"><Radio on={source === 'gmail'} />{t('Scan my Gmail')}</span>
                : GMAIL_SCAN && flags.gmailConfigured
                  ? <Button size="sm" className="self-start" onClick={connectGmail}><Icon name="link" size="sm" />{t('Connect Gmail')}</Button>
                  : GMAIL_SCAN
                    ? <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setDialog('gmail')}><Icon name="settings" size="sm" />{t('Set up Gmail')}</Button>
                        <span className="text-xs text-mute">{t('About 5 minutes, once')}</span>
                      </div>
                    : <span className="text-sm text-ink2">{t('Google is reviewing TraceErase for Gmail access. Until then, upload your email export: it gives the same result.')}</span>}
            </div>
          </Option>

          {/* Upload */}
          <Option selected={source === 'upload'} onSelect={upload ? () => setSource('upload') : undefined}>
            <Tile icon="upload" size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center justify-between gap-2"><span className="text-xl font-bold">{t('Upload your email export')}</span>{upload && <Radio on={source === 'upload'} />}</div>
              <p className="text-sm text-mute">{t('A copy of your mailbox lets AI see which companies email you, and so which ones have your data. Only the sender, subject and date are used, and the file is read inside your browser.')}</p>
              <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[13px] text-ink2">
                <li>{t('Open')} <a href="https://takeout.google.com/" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>takeout.google.com</a> {t('and press "Deselect all".')}</li>
                <li>{t('Tick only "Mail", then "Next step" and "Create export".')}</li>
                <li>{t('Google emails you a download link (minutes to a few hours). Unzip it and upload the .mbox file here.')}</li>
              </ol>
              <div onClick={e => e.stopPropagation()}>
                <UploadMailList value={upload} onChange={v => { setUpload(v); if (v) { setSource('upload'); toast(t('{n} emails read from {file}', { n: v.rows.length, file: v.name })); } else if (source === 'upload') setSource(isDemo ? 'sample' : 'gmail'); }} />
              </div>
            </div>
          </Option>

          {/* Quickest: type the apps you use */}
          {!isDemo && (
            <Option selected={source === 'typed'} onSelect={() => setSource('typed')}>
              <Tile icon="edit" size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-center justify-between gap-2"><span className="text-xl font-bold">{t('Type the apps you use')}</span><Chip tone="ok">{t('Quickest')}</Chip></div>
                <p className="text-sm text-mute">{t('No file needed. Write the apps and websites you have accounts with, separated by commas. AI finds each company, what it keeps and who it shares with.')}</p>
                <textarea value={typed} onClick={e => e.stopPropagation()} onFocus={() => setSource('typed')} onChange={e => { setTyped(e.target.value); setSource('typed'); }} rows={3}
                  placeholder={t('e.g. Swiggy, Zomato, Flipkart, irctc.co.in, Netflix')}
                  className="w-full rounded-xl border-[1.5px] border-line2 bg-card px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/15" />
                {typedList.length > 0 && <span className="text-[13px] text-mute">{t('{n} apps', { n: typedList.length })}</span>}
              </div>
            </Option>
          )}
        </div>

        <Card className="flex-row flex-wrap gap-0 overflow-hidden p-0">
          <div className="flex min-w-[260px] flex-1 flex-col gap-3 p-7"><span className="flex items-center gap-2 text-[17px] font-bold"><Icon name="eye" className="text-brand" />{t('What AI reads')}</span><span className="text-sm text-ink2">{t('Sender names, sender addresses, subject lines, sign-in app names')}</span></div>
          <div className="w-px bg-line" />
          <div className="flex min-w-[260px] flex-1 flex-col gap-3 p-7"><span className="flex items-center gap-2 text-[17px] font-bold"><Icon name="ban" className="text-leak" />{t('What we never do')}</span><span className="text-sm text-ink2">{t('Read message bodies, send email as you, sell or share your data, or train AI on it')}</span></div>
        </Card>

        <div className="flex justify-between">
          <ButtonLink to="/onboarding/identity" variant="secondary" size="lg"><Icon name="cl" />{t('Back')}</ButtonLink>
          <Button size="lg" loading={busy} disabled={(source === 'upload' && !upload?.rows.length) || (source === 'typed' && !typedList.length) || (source === 'gmail' && !gmailReady)} onClick={start}>{!busy && <Icon name="sparkle" />}{t('Start AI scan')}</Button>
        </div>
      </main>
      {dialog === 'gmail' && <GmailSetupDialog onClose={() => setDialog('')} onSaved={() => { setDialog(''); refresh(); }} />}
    </div>
  );
}
