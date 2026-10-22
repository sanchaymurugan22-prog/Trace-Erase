// Ask TraceErase: a chat grounded in the user's own receipts, requests, leaks and complaints. Text or voice.
import { useEffect, useRef, useState } from 'react';
import { Link, useQuery } from '@/lib/router';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { get, post } from '@/lib/api';
import { cn } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { Button, ButtonLink, Card, Chip, Icon, Spinner, Tile, useToast } from '@/components/ui';
import type { ChatMessage, ChatSummary } from '@/types/api';
import { ChatList } from './ChatList';
import { useVoiceInput } from './useVoiceInput';

const SUGGESTIONS = [
  'How did my data leak?',
  'Which apps should I delete next?',
  'What is the difference between "Says deleted" and "Verified"?',
  'What are my rights under the DPDP Act?'
];

export default function AssistantPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const q = useQuery();
  const { data: chats, reload } = useApi<ChatSummary[]>('/assistant/chats');
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLSpanElement>(null);
  const asked = useRef(false);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const open = async (id: string) => {
    setChatId(id);
    const c = await get<{ messages: ChatMessage[] }>('/assistant/chats/' + id);
    setMsgs(c.messages);
  };

  const ask = async (question?: string) => {
    const qn = (question ?? text).trim();
    if (!qn || busy) return;
    setText('');
    setBusy(true);
    setMsgs(m => [...m, { role: 'user', text: qn, at: new Date().toISOString() }]);
    try {
      const r = await post<{ chatId: string; message: ChatMessage }>('/assistant', { chatId, question: qn, language: lang });
      setChatId(r.chatId);
      setMsgs(m => [...m, r.message]);
      reload();
    } catch (e: any) { toast(t(e.message), 'err'); }
    finally { setBusy(false); }
  };

  const voice = useVoiceInput(lang, (heard) => { setText(heard); ask(heard); }, (msg) => toast(t(msg), 'err'));

  // "Ask about this" buttons elsewhere open this page with ?q=
  useEffect(() => { if (q.q && !asked.current) { asked.current = true; ask(q.q); } }, [q.q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ChatList chats={chats || []} active={chatId} onNew={() => { setChatId(null); setMsgs([]); }} onOpen={open} />

        <Card className="min-h-[640px] gap-0 overflow-hidden p-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-[18px]">
            <span className="flex items-center gap-3">
              <Tile icon="sparkle" tone="accent" />
              <span className="flex flex-col"><span className="text-lg font-bold">{t('Ask TraceErase')}</span><span className="text-[13px] text-mute">{t('Answers from your own receipts, requests and alerts, by Gemini')}</span></span>
            </span>
            <Chip tone="accent" icon="lock">{t('Your details are masked')}</Chip>
          </header>

          <div className="flex max-h-[600px] min-h-[380px] flex-1 flex-col gap-4 overflow-auto bg-bg p-7">
            {!msgs.length && (
              <div className="flex flex-col items-center gap-3.5 py-10 text-center">
                <Tile icon="sparkle" tone="accent" size="lg" />
                <span className="text-xl font-bold">{t('What would you like to know?')}</span>
                <span className="max-w-md text-sm text-mute">{t('Ask about any company, a leak, a deadline or your rights. Type or speak, in your language.')}</span>
              </div>
            )}
            {msgs.map((m, i) => m.role === 'user' ? (
              <div key={i} className="max-w-[78%] animate-fade self-end rounded-[18px] rounded-br-md bg-brand px-4 py-3 text-[15px] text-white">{m.text}</div>
            ) : (
              <div key={i} className="flex max-w-[82%] animate-fade flex-col gap-2.5 self-start rounded-[18px] rounded-bl-md border border-line bg-card px-4 py-3 text-[15px] shadow-card">
                <span className="whitespace-pre-wrap">{m.text}</span>
                {!!m.links?.length && <div className="flex flex-wrap gap-2">{m.links.map(l => <ButtonLink key={l.to} to={l.to} variant="secondary" size="sm">{t(l.label)}</ButtonLink>)}</div>}
                {m.ai === false && <span className="text-[13px] text-mute">{t('Answered with built-in rules (Gemini is not available)')}</span>}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 self-start rounded-[18px] border border-line bg-card px-4 py-3 text-sm text-mute"><Spinner />{t('Thinking…')}</div>}
            <span ref={end} />
          </div>

          <div className="flex flex-wrap gap-2 px-5 pt-3.5">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => ask(t(s))} className="h-9 rounded-full bg-soft px-3.5 text-[13px] font-semibold text-ink2 hover:bg-soft2">{t(s)}</button>
            ))}
          </div>
          <form className="flex items-center gap-2 px-5 pb-[18px] pt-3.5" onSubmit={e => { e.preventDefault(); ask(); }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder={t('Ask anything about your data')} aria-label={t('Ask a question')}
              className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line2 bg-card px-5 text-[15px] outline-none focus:border-brand focus:ring-4 focus:ring-brand/15" />
            <button type="button" onClick={voice.start} aria-label={t('Speak')}
              className={cn('inline-flex size-12 flex-none items-center justify-center rounded-full border border-line', voice.listening ? 'bg-leak-s text-leak' : 'bg-card text-ink2 hover:bg-soft')}>
              <Icon name="mic" />
            </button>
            <Button type="submit" className="size-12 rounded-full p-0" aria-label={t('Send')} disabled={busy || !text.trim()}><Icon name="send" /></Button>
          </form>
        </Card>
      </div>
      <p className="text-[13px] text-mute">{t('The assistant only sees your TraceErase records, with your name, email and phone replaced by placeholders.')} <Link to="/app/settings#ai">{t('AI settings')}</Link></p>
    </AppShell>
  );
}
