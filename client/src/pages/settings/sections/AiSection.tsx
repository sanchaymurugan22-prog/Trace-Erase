// AI status: which Gemini model the key uses, what is wrong if it doesn't work, and how to fix it.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { agoParts } from '@/lib/format';
import { ActionButton, Banner, Button, Chip, Field, Icon, Input, KeyValue, Well, useToast } from '@/components/ui';
import type { SetupStatus } from '@/types/api';
import { SettingsCard } from './SettingsCard';

export function AiSection() {
  const t = useT();
  const toast = useToast();
  const { ai, refresh } = useSession();
  const { data: setup, reload } = useApi<SetupStatus>('/setup/status');
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const st = setup?.ai || ai;
  const working = st.configured && !!st.lastOk && !st.lastError;
  const provider = st.provider === 'vertex' ? 'Vertex AI' : st.provider === 'studio' ? 'Google AI Studio' : null;
  const [tpl, n] = agoParts(st.lastOk);

  const test = async () => {
    const r = await post<any>('/ai/retry');
    await Promise.all([refresh(), reload()]);
    toast(r.ok ? t('Gemini works: {model}, {ms} ms', { model: r.model, ms: r.ms }) : t('Gemini is not working yet'), r.ok ? 'ok' : 'err');
  };
  const saveKey = async () => {
    const r = await post<any>('/setup/gemini', { key });
    await Promise.all([refresh(), reload()]);
    setEditing(false); setKey('');
    toast(r.model && !r.lastError ? t('Key saved. Gemini works with {model}.', { model: r.model }) : t('Key saved, but Gemini is not working with it yet. See the reason below.'), r.model && !r.lastError ? 'ok' : 'err');
  };

  return (
    <SettingsCard id="ai" title={t('AI (Google Gemini)')} description={t('Gemini powers discovery, policy reading, letters, reply checking, leak investigation, complaints, the assistant and translation.')}>
      <div className="flex flex-wrap items-center gap-3">
        {!st.configured ? <Chip icon="alert">{t('No key: using built-in rules')}</Chip>
          : working ? <Chip tone="ok" icon="check">{t('Working')}</Chip>
          : st.lastError ? <Chip tone="leak" icon="alert">{t('Not working')}</Chip>
          : <Chip tone="pend" icon="clock">{t('Checking…')}</Chip>}
        <span className="flex-1" />
        <ActionButton variant="secondary" size="sm" onClick={test}><Icon name="refresh" size="sm" />{t('Test again')}</ActionButton>
        <Button variant="ghost" size="sm" onClick={() => setEditing(e => !e)}><Icon name="key" size="sm" />{t(st.configured ? 'Change key' : 'Add key')}</Button>
      </div>

      <Well className="gap-0 py-1">
        <KeyValue label={t('Key')}><span className="font-mono" translate="no">{setup?.keyHint || t('Not set')}</span></KeyValue>
        <KeyValue label={t('Model in use')}><span translate="no">{st.model || '—'}</span></KeyValue>
        {st.fastModel && st.fastModel !== st.model && <KeyValue label={t('Model for quick tasks')}><span translate="no">{st.fastModel}</span></KeyValue>}
        <KeyValue label={t('Service')}>{provider ? t(provider) : '—'}</KeyValue>
        <KeyValue label={t('Last answer')}>{st.lastOk ? t(tpl, { n }) : '—'}</KeyValue>
      </Well>

      {st.configured && st.lastError && (
        <Banner tone="warn" icon="alert">
          <span className="flex flex-col gap-1.5 text-sm">
            <b>{t('Why it is not working')}</b>
            <span>{t(st.hint || st.lastError)}</span>
            <span className="text-[13px] text-mute">{t('Google said:')} <span translate="no">{st.lastError}</span></span>
            <span className="text-[13px] text-mute">{t('Until then TraceErase keeps working with built-in rules, and switches to AI as soon as the key works.')}</span>
          </span>
        </Banner>
      )}

      {editing && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
          <Field label={t('Gemini API key')} htmlFor="gkey" hint={<>{t('Get a free key at')} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>. {t('It is saved only in server/.env on this computer and never sent to the browser again.')}</>}>
            <Input id="gkey" type="password" autoComplete="off" placeholder="AIza… / AQ.…" value={key} onChange={e => setKey(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setEditing(false); setKey(''); }}>{t('Cancel')}</Button>
            <ActionButton disabled={key.trim().length < 20} onClick={saveKey}><Icon name="check" />{t('Save and test')}</ActionButton>
          </div>
        </div>
      )}
      <span className="text-[13px] text-mute">{t('Your name, email and phone number are replaced with placeholders before anything is sent to AI.')}</span>
    </SettingsCard>
  );
}
