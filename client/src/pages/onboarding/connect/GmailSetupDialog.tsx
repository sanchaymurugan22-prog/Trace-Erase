// Guides the user through creating a Google OAuth client, then saves it to server/.env.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { post } from '@/lib/api';
import { copyText } from '@/lib/format';
import { Banner, Button, Field, Icon, Input, Modal, useToast } from '@/components/ui';

const STEPS: [string, string, string?][] = [
  ['Create a Google Cloud project', 'Open Google Cloud Console and create a project (any name, for example "TraceErase").', 'https://console.cloud.google.com/projectcreate'],
  ['Turn on the Gmail API', 'In the project, open the Gmail API page and press Enable.', 'https://console.cloud.google.com/apis/library/gmail.googleapis.com'],
  ['Set up the consent screen', 'Choose "External", fill in the app name and your email, and add your own Gmail address under "Test users".', 'https://console.cloud.google.com/apis/credentials/consent'],
  ['Create an OAuth client', 'Credentials → Create credentials → OAuth client ID → Web application. Under "Authorized redirect URIs" add the address below.', 'https://console.cloud.google.com/apis/credentials'],
  ['Paste the Client ID and secret', 'Copy them from the dialog Google shows, and paste them here. They are saved only in server/.env on this computer.']
];

export function GmailSetupDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const toast = useToast();
  const { flags } = useSession();
  const redirect = flags.gmailRedirectUri || 'http://localhost:4000/api/gmail/callback';
  const [f, setF] = useState({ clientId: '', clientSecret: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await post('/setup/gmail', f); toast(t('Gmail is set up. Now press Connect.')); onSaved(); }
    catch (e2: any) { setErr(t(e2.message)); } finally { setBusy(false); }
  };
  return (
    <Modal label={t('Set up Gmail scanning')} onClose={onClose} wide>
      <div className="flex flex-col gap-1.5 pr-8">
        <h2 className="text-2xl font-bold">{t('Set up Gmail scanning')}</h2>
        <p className="text-sm text-mute">{t('Google only lets an app read your inbox through your own OAuth client. It takes about 5 minutes, once. TraceErase asks only for read-only metadata: senders and subject lines.')}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {STEPS.map(([title, body, link], i) => (
          <li key={title} className="flex gap-3">
            <span className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-brand-s text-[13px] font-bold text-brand">{i + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold">{t(title)}</span>
              <span className="text-sm text-mute">{t(body)}</span>
              {link && <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold">{t('Open in Google Cloud')}<Icon name="ext" size="xs" /></a>}
              {i === 3 && (
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-soft px-3 py-2">
                  <code className="flex-1 truncate font-mono text-[13px]" translate="no">{redirect}</code>
                  <Button variant="secondary" size="sm" onClick={() => copyText(redirect, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <form className="flex flex-col gap-4 rounded-2xl border border-line p-4" onSubmit={save}>
        <Field label={t('Client ID')} htmlFor="gcid"><Input id="gcid" required placeholder="1234-abc.apps.googleusercontent.com" value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })} /></Field>
        <Field label={t('Client secret')} htmlFor="gcs"><Input id="gcs" required type="password" placeholder="GOCSPX-…" value={f.clientSecret} onChange={e => setF({ ...f, clientSecret: e.target.value })} /></Field>
        {err && <Banner tone="leak" icon="alert"><span className="text-sm">{err}</span></Banner>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" loading={busy}><Icon name="check" />{t('Save and continue')}</Button>
        </div>
      </form>
      <p className="text-xs text-mute">{t('No time for this now? Use the sample inbox or upload a Google Takeout file instead.')}</p>
    </Modal>
  );
}
