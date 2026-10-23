// Demo controls: a side drawer for judges and testing (only when DEMO_MODE=true on the server).
import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { get, post } from '@/lib/api';
import { cn } from '@/lib/format';
import { Button, ButtonLink, Chip, Icon, Input, Select, Spinner, Tabs, Textarea, useToast, type IconName } from '@/components/ui';
import type { Address } from '@/types/api';

type Tab = 'story' | 'messages' | 'tools';

function Section({ title, icon, children, hint }: { title: string; icon: IconName; children: React.ReactNode; hint?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-s text-brand"><Icon name={icon} size="sm" /></span>
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
      </div>
      {hint && <p className="m-0 text-[13px] leading-5 text-mute">{hint}</p>}
      {children}
    </section>
  );
}

function StoryStep({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-soft p-3">
      <span className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-mute">{sub}</span>
      </div>
      {children}
    </div>
  );
}

export function DemoPanel() {
  const { flags, ai, refresh } = useSession();
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('story');
  const [busy, setBusy] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [mail, setMail] = useState({ to: '', from: 'Zomato <noreply@zomato.com>', subject: 'Your order is on its way', text: 'Your order #4412 will arrive in 25 minutes.', dkim: 'pass' });
  const [sms, setSms] = useState({ from: 'Swiggy', text: 'Your order is on the way. Track it in the app.' });
  const [call, setCall] = useState({ from: '+91 98450 11223', callerName: 'Unknown sender' });

  useEffect(() => {
    if (!open) return;
    get<{ addresses: Address[] }>('/identity').then(r => {
      const active = r.addresses.filter(a => a.status === 'active');
      setAddresses(active);
      setMail(m => ({ ...m, to: m.to || active[0]?.email || '' }));
    }).catch(() => {});
  }, [open, busy]);

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    try {
      const msg = await fn();
      toast(msg ? t(msg) : t('Done'));
      await refresh();
      window.dispatchEvent(new Event('te:refresh'));
    } catch (e: any) { toast(t(e.message), 'err'); }
    finally { setBusy(''); }
  };

  const aiOk = ai.configured && !ai.lastError && !ai.paused;
  const day = flags.clockOffsetDays || 0;

  return (
    <>
      <Button variant="dark" className="fixed bottom-5 right-5 z-[70] shadow-modal" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Icon name="zap" />{t('Demo controls')}{day ? <span className="rounded-full bg-white/15 px-2 text-xs">+{day} {t('days')}</span> : null}
      </Button>

      {open && <div className="fixed inset-0 z-[70] bg-navy/30" onClick={() => setOpen(false)} />}
      <aside className={cn('fixed right-0 top-0 z-[71] flex h-screen w-[420px] max-w-full flex-col border-l border-line bg-bg shadow-modal transition-transform duration-200', open ? 'translate-x-0' : 'translate-x-full')}
        aria-hidden={!open} aria-label={t('Demo controls')}>
        <header className="flex items-start gap-3 border-b border-line bg-card px-5 py-4">
          <span className="inline-flex size-10 flex-none items-center justify-center rounded-xl bg-navy text-accent-b"><Icon name="zap" /></span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-lg font-bold text-ink">{t('Demo controls')}</h2>
            <span className="text-[13px] text-mute">{t('For judges and testing. Turn off with DEMO_MODE=false.')}</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label={t('Close')} className="inline-flex size-9 items-center justify-center rounded-xl text-mute hover:bg-soft hover:text-ink"><Icon name="x" size="sm" /></button>
        </header>

        <div className="flex items-center gap-2 border-b border-line bg-card px-5 py-3">
          <Chip tone={aiOk ? 'ok' : ai.configured ? 'nr' : 'neutral'} icon={aiOk ? 'sparkle' : 'alert'}>
            {aiOk ? `Gemini · ${ai.model || t('ready')}` : ai.configured ? t('Gemini not working') : t('AI off: built-in rules')}
          </Chip>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" loading={busy === 'ai'} onClick={() => run('ai', async () => {
            const r = await post('/ai/retry');
            return r.ok ? `Gemini works (${r.model}, ${r.ms} ms)` : 'Gemini is not working yet. See Settings → AI for the fix.';
          })}>{t('Test Gemini')}</Button>
        </div>

        <div className="bg-card px-5"><Tabs value={tab} onChange={setTab} options={[{ value: 'story', label: t('Story') }, { value: 'messages', label: t('Messages') }, { value: 'tools', label: t('Clock and tools') }]} /></div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {tab === 'story' && (
            <>
              <Section title={t('Run the full story')} icon="play" hint={t('Zomato names its partners in its reply, AdNexa ignores you and leaks your address, MakeMyTrip becomes Verified.')}>
                <StoryStep n={1} title={t('Set up demo story')} sub={t('Zomato and MakeMyTrip get protected emails')}>
                  <Button size="sm" loading={busy === 'story'} onClick={() => run('story', async () => {
                    const r = await post<{ companies: { companyId: string }[] }>('/demo/story');
                    setOpen(false);
                    navigate('/app/delete?ids=' + r.companies.map(c => c.companyId).join(','));
                    return 'Now review and sign the request.';
                  })}>{t('Start')}</Button>
                </StoryStep>
                <StoryStep n={2} title={t('Companies reply')} sub={t('Zomato names Razorpay and AdNexa')}>
                  <Button size="sm" variant="secondary" loading={busy === 'replies'} onClick={() => run('replies', async () => {
                    const r = await post<{ company: string; action: string }[]>('/demo/replies');
                    return r.length ? r.map(x => `${x.company}: ${x.action === 'reply-checked' ? t('replied') : x.action}`).join(' · ') : 'No company is waiting to reply';
                  })}>{t('Reply now')}</Button>
                </StoryStep>
                <StoryStep n={3} title={t('Move 15 days ahead')} sub={t('AdNexa ignored you: complaint is prepared')}>
                  <Button size="sm" variant="secondary" loading={busy === 'd15'} onClick={() => run('d15', async () => { const r = await post('/demo/advance', { days: 15 }); return `Clock moved to day +${r.offsetDays}`; })}>+15 {t('days')}</Button>
                </StoryStep>
                <StoryStep n={4} title={t('Simulate a leak')} sub={t('PizzaPoint emails your Zomato-only address')}>
                  <Button size="sm" variant="danger" loading={busy === 'leak'} onClick={() => run('leak', async () => { const r = await post('/demo/leak'); return r.action === 'leak' ? 'Leak caught and investigated' : r.action; })}>{t('Leak')}</Button>
                </StoryStep>
                <StoryStep n={5} title={t('Move 30 days ahead')} sub={t('Silent addresses become Verified')}>
                  <Button size="sm" variant="secondary" loading={busy === 'd30'} onClick={() => run('d30', async () => { const r = await post('/demo/advance', { days: 30 }); return `Clock moved to day +${r.offsetDays}`; })}>+30 {t('days')}</Button>
                </StoryStep>
              </Section>
            </>
          )}

          {tab === 'messages' && (
            <>
              <Section title={t('Send an email to a protected address')} icon="mail" hint={addresses.length ? undefined : t('Protect a sign-up first to get a protected address.')}>
                <Select value={mail.to} onChange={e => setMail({ ...mail, to: e.target.value })} aria-label={t('To')} disabled={!addresses.length} className="h-11 text-sm">
                  {addresses.map(a => <option key={a.id} value={a.email}>{a.email} ({a.company?.name})</option>)}
                </Select>
                <Input className="h-11 text-sm" value={mail.from} onChange={e => setMail({ ...mail, from: e.target.value })} aria-label={t('From')} placeholder={t('From')} />
                <Input className="h-11 text-sm" value={mail.subject} onChange={e => setMail({ ...mail, subject: e.target.value })} aria-label={t('Subject')} placeholder={t('Subject')} />
                <Textarea rows={3} className="text-sm" value={mail.text} onChange={e => setMail({ ...mail, text: e.target.value })} aria-label={t('Message')} />
                <label className="flex items-center gap-2 text-sm text-ink2">
                  <input type="checkbox" className="checkbox" checked={mail.dkim === 'pass'} onChange={e => setMail({ ...mail, dkim: e.target.checked ? 'pass' : 'fail' })} />
                  {t('Valid DKIM signature (untick to test a fake email)')}
                </label>
                <Button full loading={busy === 'email'} disabled={!mail.to} onClick={() => run('email', async () => { const r = await post('/demo/email', mail); return `Result: ${r.action}`; })}>
                  <Icon name="send" size="sm" />{t('Deliver email')}
                </Button>
              </Section>
              <Section title={t('Send an SMS to the protected number')} icon="phone">
                <Input className="h-11 text-sm" value={sms.from} onChange={e => setSms({ ...sms, from: e.target.value })} aria-label={t('From')} placeholder={t('From')} />
                <Textarea rows={2} className="text-sm" value={sms.text} onChange={e => setSms({ ...sms, text: e.target.value })} aria-label={t('Message')} />
                <Button full variant="secondary" loading={busy === 'sms'} onClick={() => run('sms', async () => { const r = await post('/demo/sms', sms); return `SMS ${r.action}: ${r.reason}`; })}>
                  <Icon name="send" size="sm" />{t('Deliver SMS')}
                </Button>
              </Section>
              <Section title={t('Simulate a call')} icon="phone" hint={t('Calls and SMS from apps you use ring through. Strangers are stopped.')}>
                <Input className="h-11 text-sm" value={call.callerName} onChange={e => setCall({ ...call, callerName: e.target.value })} aria-label={t('Name')} placeholder={t('Name')} />
                <Input className="h-11 text-sm" dir="ltr" value={call.from} onChange={e => setCall({ ...call, from: e.target.value })} aria-label={t('Phone')} placeholder={t('Phone')} />
                <Button full variant="secondary" loading={busy === 'call'} onClick={() => run('call', async () => { const r = await post('/demo/call', call); return r.action === 'rang' ? t('Rang through') : `${t('Blocked')}: ${t(r.reason || '')}`; })}>
                  <Icon name="phone" size="sm" />{t('Call the protected number')}
                </Button>
              </Section>
            </>
          )}

          {tab === 'tools' && (
            <>
              <Section title={t('Demo clock')} icon="clock" hint={t('Move time forward to see reminders, grievances, complaints and verification.')}>
                <div className="flex items-baseline gap-2"><span className="font-display text-3xl font-extrabold">+{day}</span><span className="text-sm text-mute">{t('days from today')}</span></div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 7, 15, 30].map(d => (
                    <Button key={d} variant="secondary" size="sm" disabled={!!busy} onClick={() => run('d' + d, async () => { const r = await post('/demo/advance', { days: d }); return `Clock moved to day +${r.offsetDays}`; })}>+{d}{t('d')}</Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => run('reset', async () => { await post('/demo/reset-clock'); return 'Clock reset'; })}><Icon name="refresh" size="sm" />{t('Reset clock to today')}</Button>
              </Section>
              <Section title={t('Tools')} icon="settings">
                <div className="grid grid-cols-2 gap-2">
                  <ButtonLink to="/app/activity" variant="secondary" size="sm" onClick={() => setOpen(false)}><Icon name="inbox" size="sm" />{t('Activity log')}</ButtonLink>
                  <Button variant="secondary" size="sm" loading={busy === 'anchor'} onClick={() => run('anchor', async () => { const b = await post('/demo/anchor'); return b ? `Batch #${b.number} anchored (${b.size} receipts)` : 'Nothing new to anchor'; })}><Icon name="cube" size="sm" />{t('Anchor receipts')}</Button>
                </div>
              </Section>
            </>
          )}
        </div>
        {busy && <div className="flex items-center gap-2 border-t border-line bg-card px-5 py-3 text-[13px] text-mute"><Spinner />{t('Working…')}</div>}
      </aside>
    </>
  );
}
