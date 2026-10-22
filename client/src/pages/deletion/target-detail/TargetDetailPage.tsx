// One company inside a request: the letter, every event, and the AI's check of its reply.
import { useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { copyText, fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, AiCard, AiTag, Banner, Button, ButtonLink, Card, Chip, CompanyAvatar, ErrorBox, Field, Icon, Input, PageLoading, StatusChip, Textarea, Timeline, useToast, type IconName } from '@/components/ui';
import { useSession } from '@/lib/session';

const EVENT_ICON: Record<string, IconName> = { sent: 'send', otp: 'key', reminder: 'bell', grievance: 'alert', overdue: 'timer', claimed: 'mailc', verified: 'shieldc', partial: 'receipt', reply: 'mail', prepared: 'edit', refused: 'ban' };

export default function TargetDetailPage({ params }: { params: Record<string, string> }) {
  const toast = useToast();
  const t = useT();
  const { data: tg, loading, error, reload } = useApi<any>('/targets/' + params.tid, { interval: 6000 });
  const [ref, setRef] = useState('');
  const [sendTo, setSendTo] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const { user } = useSession();
  if (loading) return <AppShell active="/app/requests"><PageLoading /></AppShell>;
  if (error || !tg) return <AppShell active="/app/requests"><ErrorBox error={error} /></AppShell>;
  const letter = tg.letter;
  const check = tg.replyCheck;
  const name = tg.company.name;
  const events = tg.events || [];
  const real = !user?.demo;
  // Letters this person sends from their own email (no automatic sending on this server)
  const selfSend = real && !tg.resolved && tg.channel !== 'webform' && !tg.canSend && tg.delivery !== 'email';
  const mailto = (l: any) => `mailto:${l.to || ''}?subject=${encodeURIComponent(l.subject)}&body=${encodeURIComponent(l.body)}`;

  return (
    <AppShell active="/app/requests">
      <nav className="flex items-center gap-2 text-sm"><Link to="/app/requests" className="font-semibold">{t('Deletion requests')}</Link><Icon name="cr" size="sm" className="text-mute" /><Link to={`/app/requests/${tg.request.id}`} className="font-semibold">{tg.request.number}</Link><Icon name="cr" size="sm" className="text-mute" /><span className="text-mute" translate="no">{name}</span></nav>
      <div className="flex flex-wrap items-center gap-4">
        <CompanyAvatar company={tg.company} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl font-extrabold tracking-tight" translate="no">{name}</h1><StatusChip status={tg.status} /></div>
          <p className="text-mute">
            {tg.via ? `${t('Partner of {name}', { name: tg.via.name })} · ` : ''}{t(tg.channel === 'webform' ? 'Sent by web form' : 'Sent by email')}
            {tg.sentAt ? ` · ${t('day {n}', { n: tg.day })}` : ''}{tg.identifier ? ` · ${t('as {who}', { who: tg.identifier })}` : ''}
          </p>
        </div>
        <ButtonLink to={`/app/assistant?q=${encodeURIComponent(`What is happening with my request to ${name}?`)}`} variant="secondary"><Icon name="sparkle" />{t('Ask about this')}</ButtonLink>
      </div>

      {tg.canSend && (
        <Card className="border-[#CAD7FA] bg-brand-s">
          <span className="flex items-center gap-2 text-[17px] font-bold"><Icon name="send" className="text-brand" />{t("Check {name}'s privacy email, then send", { name })}</span>
          <span className="text-sm text-ink2">{letter?.guessedAddress ? t("We couldn't find this address in {name}'s privacy policy, so it is a guess. Look for \"grievance officer\" or \"privacy\" on their website and correct it if needed.", { name }) : t('Your letter is ready. Check the address and send it from your protected email.')}</span>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-[320px]" dir="ltr" type="email" value={sendTo ?? letter?.to ?? ''} onChange={e => setSendTo(e.target.value)} aria-label={t('Company email')} />
            <ActionButton onClick={async () => { await post(`/targets/${tg.id}/send`, { to: sendTo ?? letter?.to }); toast(t('Sent to {name}', { name })); reload(); }}><Icon name="send" />{t('Send')}</ActionButton>
          </div>
        </Card>
      )}

      {tg.status === 'action-needed' && tg.channel === 'webform' && (
        <Card className="border-[#CAD7FA] bg-brand-s">
          <span className="flex items-center gap-2 text-[17px] font-bold"><Icon name="globe" className="text-brand" />{t('{name} uses a web form', { name })}</span>
          <span className="text-sm text-ink2">{t("Open their privacy page, paste the text below into their deletion form, then tell us the ticket number. We'll track it from there.")}</span>
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-11 items-center gap-2 rounded-xl border border-line2 bg-card px-[18px] font-semibold text-ink hover:bg-soft hover:text-ink" href={tg.formUrl} target="_blank" rel="noreferrer"><Icon name="ext" />{t('Open {site}', { site: tg.company.domain })}</a>
            <Input className="max-w-[240px]" placeholder={t('Ticket number (optional)')} value={ref} onChange={e => setRef(e.target.value)} />
            <ActionButton onClick={async () => { await post(`/targets/${tg.id}/webform-done`, { reference: ref }); toast(t('Marked as submitted')); reload(); }}>{t("I've submitted it")}</ActionButton>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 max-[1100px]:grid-cols-1">
        <Card className="p-7">
          <h2 className="text-xl font-bold">{t('Timeline')}</h2>
          {events.length ? (
            <Timeline items={events.map((e: any, i: number) => ({
              icon: EVENT_ICON[e.type] || 'clock',
              state: i === events.length - 1 && !tg.resolved ? 'current' : ['overdue', 'refused'].includes(e.type) ? 'warn' : 'done',
              title: <span className="font-semibold">{t(e.text)}</span>,
              sub: <span className="flex flex-col gap-1.5 text-[13px] text-mute"><span>{fmtDateTime(e.at)}{e.receiptId && <> · <Link to={`/app/receipts/${e.receiptId}`}>{t('receipt')}</Link></>}</span>
                {e.letter && selfSend && <span className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => copyText(`${e.letter.subject}\n\n${e.letter.body}`, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button>
                  <a className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line2 bg-card px-3 text-sm font-semibold text-ink hover:bg-soft hover:text-ink" href={mailto(e.letter)}><Icon name="mail" size="sm" />{t('Open in mail app')}</a>
                </span>}</span>
            }))} />
          ) : <span className="text-sm text-mute">{t('Nothing yet.')}</span>}
          {tg.resolved && <Banner tone="ok" icon="eye"><span className="text-sm">{t('We keep watching your {name} address. Any message now would be a leak.', { name })}</span></Banner>}
        </Card>

        <div className="flex flex-col gap-6">
          {tg.status === 'claimed' && tg.silenceLeft != null && (
            <Banner tone="info" icon="eye"><span className="text-sm">{t('Watching your {name}-only address. If no one uses it for {n} more days, this becomes Verified.', { name, n: tg.silenceLeft })}</span></Banner>
          )}
          {selfSend && (
            <Card>
              <h2 className="text-[17px] font-bold">{t('Got a reply in your inbox?')}</h2>
              <span className="text-sm text-mute">{t('Paste the email from {name} here. AI checks whether it really confirms deletion, what was kept and who your data was shared with.', { name })}</span>
              <Field label={t('Their reply')} htmlFor="rp"><Textarea id="rp" rows={6} value={reply} onChange={e => setReply(e.target.value)} /></Field>
              <ActionButton className="self-start" disabled={reply.trim().length < 15} onClick={async () => { await post(`/targets/${tg.id}/reply`, { text: reply }); setReply(''); toast(t('Reply checked')); reload(); }}><Icon name="sparkle" />{t('Check the reply')}</ActionButton>
            </Card>
          )}
          {check && (
            <AiCard className="gap-1 p-6">
              <div className="flex items-center justify-between pb-2">
                <AiTag ai={check.ai} label="AI reply check" />
                <Chip tone={check.verdict === 'genuine' ? 'clm' : check.verdict === 'not-genuine' ? 'leak' : 'nr'}>{t(check.verdict === 'genuine' ? 'Genuine reply' : check.verdict === 'not-genuine' ? 'Not genuine' : 'Needs a look')}</Chip>
              </div>
              {(check.checks || []).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3 border-b border-[#CDEDE6] py-2.5 text-sm last:border-b-0"><Icon name={c.ok ? 'check' : 'alert'} className={c.ok ? 'text-ok' : 'text-nr'} />{t(c.text)}</div>
              ))}
              {check.summary && <span className="pt-2 text-sm text-ink2">{t(check.summary)}</span>}
            </AiCard>
          )}
          {tg.result && (
            <Card>
              <div className="flex items-center justify-between"><h2 className="text-[17px] font-bold">{t('Result')}</h2>{tg.receipt && <Link to={`/app/receipts/${tg.receipt.id}`} className="text-sm font-semibold">{t('Signed receipt')}</Link>}</div>
              {(tg.result.deleted || []).map((x: string) => <span key={x} className="flex items-center gap-2 text-sm"><Icon name="check" size="sm" className="text-ok" />{t('Deleted')}: {t(x)}</span>)}
              {(tg.result.kept || []).map((k: any) => <span key={k.field} className="flex items-center gap-2 text-sm"><Icon name="half" size="sm" className="text-part" />{t('Kept')}: {t(k.field)} ({t(k.law)})</span>)}
            </Card>
          )}
          {check?.sharedWith?.length > 0 && (
            <Card>
              <div className="flex items-center justify-between"><h2 className="text-[17px] font-bold">{t('Partners named in the reply')}</h2><AiTag ai={check.ai} label="Found by AI" /></div>
              <span className="text-sm text-mute">{t('{name} said it gave your data to these companies. Each one was sent its own deletion request.', { name })}</span>
              {check.sharedWith.map((p: any) => (
                <span key={p.name} className="flex items-center gap-2 text-sm"><Icon name="share" size="sm" className="text-brand" /><span className="flex-1"><b translate="no">{p.name}</b>{p.fields?.length ? ` · ${p.fields.map((f: string) => t(f)).join(', ')}` : ''}</span><span className="text-[13px] text-mute">{t(p.purpose)}</span></span>
              ))}
            </Card>
          )}
          {letter && (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex flex-col gap-1 border-b border-line bg-soft px-[18px] py-3.5 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-bold">{letter.subject}</span><AiTag ai={letter._ai} label="AI letter" /></div>
                <span className="text-[13px] text-mute">{t('To')} {letter.to}{letter.guessedAddress ? ` (${t('guessed address, check it')})` : ''} · {t('from')} {tg.identifier}</span>
              </div>
              <div className="whitespace-pre-wrap p-[18px] text-sm text-ink2">{letter.body}</div>
              <div className="flex flex-wrap items-center gap-2 px-[18px] pb-[18px]">
                <Button variant="secondary" size="sm" onClick={() => copyText(`${letter.subject}\n\n${letter.body}`, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button>
                <a className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line2 bg-card px-3 text-sm font-semibold text-ink hover:bg-soft hover:text-ink" href={`mailto:${letter.to}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`}><Icon name="mail" size="sm" />{t('Open in mail app')}</a>
                {selfSend && !tg.manualSentAt && <ActionButton size="sm" onClick={async () => { await post(`/targets/${tg.id}/mark-sent`); toast(t('Noted. The 30-day clock starts today.')); reload(); }}><Icon name="check" size="sm" />{t("I've sent it")}</ActionButton>}
                {selfSend && tg.manualSentAt ? <span className="text-[13px] text-mute">{t('You sent it on {date}', { date: fmtDateTime(tg.manualSentAt) })}</span>
                  : tg.outbox && <span className="text-[13px] text-mute">{selfSend ? t('Send it from your own email: press "Open in mail app", then "I\'ve sent it".') : t(tg.outbox.deliveryNote || '')}</span>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
