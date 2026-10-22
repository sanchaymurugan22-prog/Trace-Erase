// Fix an old account: 1 switch to a protected email, 2 ask what they hold, 3 read the reply, 4 decide.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { agoParts, cn, copyText, fmtDate } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, AiTag, Button, ButtonLink, Card, Chip, CompanyAvatar, Icon, Input, KeyValue, PageLoading, Textarea, useToast } from '@/components/ui';

const STEPS: [string, string][] = [['Switch email', 'Use your protected address'], ['Ask what they hold', 'AI writes the request'], ['Check their reply', 'AI reads it'], ['Delete or keep', 'Your choice']];

export default function FixAccountPage({ params }: { params: Record<string, string> }) {
  const toast = useToast();
  const navigate = useNavigate();
  const t = useT();
  const { data: c, loading } = useApi<any>('/companies/' + params.id);
  const [fix, setFix] = useState<any>(null);
  const [letter, setLetter] = useState<any>(null);
  const [addr, setAddr] = useState<any>(null);
  useEffect(() => { if (c) { setFix(c.fix || { step: 1 }); setLetter(c.fix?.letter || null); } }, [c]);
  useEffect(() => { if (c && !addr) post(`/companies/${params.id}/fix`, { action: 'view' }).then(r => setAddr(r.address)).catch(() => {}); }, [c]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    const r = await post(`/companies/${params.id}/fix`, { action, ...extra });
    setFix(r.fix); setAddr(r.address); if (r.fix.letter) setLetter(r.fix.letter);
    return r;
  };
  if (loading || !fix || !c) return <AppShell active="/app/companies"><PageLoading /></AppShell>;
  const name = c.company.name;
  const [tpl, n] = agoParts(c.lastSeen);

  return (
    <AppShell active="/app/companies">
      <nav className="flex items-center gap-2 text-sm"><Link to="/app/companies" className="font-semibold">{t('Companies')}</Link><Icon name="cr" size="sm" className="text-mute" /><Link to={`/app/companies/${c.id}`} className="font-semibold" translate="no">{name}</Link><Icon name="cr" size="sm" className="text-mute" /><span className="text-mute">{t('Fix old account')}</span></nav>
      <div className="flex flex-wrap items-center gap-4">
        <CompanyAvatar company={c.company} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">{t('Fix your {name} account', { name })}</h1>
          <p className="text-mute">{c.lastSeen ? t('Last used {when}.', { when: t(tpl, { n }).toLowerCase() }) + ' ' : ''}{t('It still has your real email.')}{c.partnersCount ? ' ' + t('It shares with {n} kinds of partners.', { n: c.partnersCount }) : ''}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 max-[1000px]:grid-cols-2">
        {STEPS.map(([h, s], i) => {
          const st = i + 1 < fix.step ? 'done' : i + 1 === fix.step ? 'now' : '';
          return (
            <div key={h} className={cn('flex items-center gap-3 rounded-2xl border-[1.5px] p-4', st === 'now' ? 'border-brand bg-card' : st === 'done' ? 'border-[#BDE8E0] bg-accent-s' : 'border-line bg-card')}>
              <span className={cn('flex size-8 flex-none items-center justify-center rounded-full font-bold', st === 'done' ? 'bg-accent text-white' : st === 'now' ? 'bg-brand text-white' : 'bg-soft2 text-mute')}>{st === 'done' ? <Icon name="check" size="sm" /> : i + 1}</span>
              <span className="flex flex-col"><span className="text-sm font-bold">{t(h)}</span><span className="text-[13px] text-mute">{t(s)}</span></span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 max-[1100px]:grid-cols-1">
        <Card className="gap-[18px] p-7">
          {fix.step === 1 && <>
            <h2 className="text-xl font-bold">{t('Step 1 · Change your email on {name}', { name })}</h2>
            <p className="text-ink2">{t("Open {name}'s account settings and replace your email with this protected address. Then come back and tick done.", { name })}</p>
            {addr && <div className="flex items-center gap-3 rounded-[14px] bg-soft px-4 py-3"><Icon name="mail" className="text-accent" /><span className="flex-1 font-mono font-bold" translate="no">{addr.email}</span><Button variant="ghost" size="sm" onClick={() => copyText(addr.email, (m, k) => toast(t(m), k))}><Icon name="copy" size="sm" />{t('Copy')}</Button></div>}
            <div className="flex flex-wrap gap-2">
              <a className="inline-flex h-11 items-center gap-2 rounded-xl border border-line2 bg-card px-[18px] font-semibold text-ink hover:bg-soft hover:text-ink" href={`https://${c.company.domain}`} target="_blank" rel="noreferrer"><Icon name="ext" />{t('Open {site}', { site: c.company.domain })}</a>
              <ActionButton onClick={() => act('switched')}>{t("I've changed it")}<Icon name="ar" /></ActionButton>
            </div>
          </>}
          {fix.step === 2 && <>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t('Step 2 · Ask what {name} holds', { name })}</h2>{letter && <AiTag ai={letter._ai} label="Written by AI" />}</div>
            {!letter ? <>
              <p className="text-ink2">{t('Under Section 11 of the DPDP Act you can ask for a summary of your data and everyone it was shared with. AI writes the request for you.')}</p>
              <ActionButton className="self-start" onClick={() => act('draft-access')}><Icon name="sparkle" />{t('Write the request')}</ActionButton>
            </> : <>
              <div className="flex flex-col overflow-hidden rounded-2xl border border-line">
                <div className="flex flex-col gap-1.5 border-b border-line bg-soft px-[18px] py-3.5 text-sm">
                  <div className="flex items-center gap-2"><span className="w-16 text-mute">{t('To')}</span><span className="font-semibold" translate="no">{letter.to}</span>{letter.guessed && <Chip tone="nr" className="h-[22px]">{t('Guessed address')}</Chip>}</div>
                  <div className="flex items-center gap-2"><span className="w-16 text-mute">{t('From')}</span><span className="font-mono" translate="no">{addr?.email}</span></div>
                  <div className="flex items-center gap-2"><span className="w-16 text-mute">{t('Subject')}</span><Input className="h-9" value={letter.subject} onChange={e => setLetter({ ...letter, subject: e.target.value })} aria-label={t('Subject')} /></div>
                </div>
                <Textarea rows={11} className="rounded-none border-0 focus:ring-0" value={letter.body} onChange={e => setLetter({ ...letter, body: e.target.value })} aria-label={t('Request text')} />
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={async () => { await act('send-access', { letter }); toast(t('Request sent (see Dev outbox)')); }}><Icon name="send" />{t('Send request')}</ActionButton>
                <a className="inline-flex h-11 items-center gap-2 rounded-xl border border-line2 bg-card px-[18px] font-semibold text-ink hover:bg-soft hover:text-ink" href={`mailto:${letter.to}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`}><Icon name="mail" />{t('Open in my mail app')}</a>
              </div>
            </>}
          </>}
          {fix.step === 3 && <>
            <h2 className="text-xl font-bold">{t("Step 3 · Waiting for {name}'s reply", { name })}</h2>
            <p className="text-ink2">{t('Sent {date}. Their reply will reach your protected address and AI will read it.', { date: fmtDate(fix.sentAt) })}</p>
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={async () => { await act('decide', { decision: 'delete' }); navigate('/app/delete?ids=' + c.id); }}><Icon name="trash" />{t('Skip and delete now')}</ActionButton>
              <ActionButton variant="secondary" onClick={() => act('decide', { decision: 'keep' })}>{t('Keep the account')}</ActionButton>
            </div>
          </>}
          {fix.step === 4 && <>
            <h2 className="text-xl font-bold">{t('Done')}</h2>
            <p className="text-ink2">{fix.decision === 'keep' ? t('You kept {name}, now on a protected email. Any leak will be caught.', { name }) : t('Deletion request started.')}</p>
            <ButtonLink to={`/app/companies/${c.id}`} variant="secondary" className="self-start">{t('Back to {name}', { name })}</ButtonLink>
          </>}
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="gap-3 border-[#F5CFAE] bg-nr-s"><span className="flex items-center gap-2 text-[17px] font-bold"><Icon name="alert" className="text-nr" />{t('Being honest about limits')}</span><p className="text-sm text-ink2">{t("Copies {name} already sent to partners follow those companies' own rules. We find out who they are from the reply, then ask each one.", { name })}</p></Card>
          <Card><h2 className="text-[17px] font-bold">{t('What they likely hold')}</h2><div className="flex flex-col">{(c.dataTypes || []).map((d: string) => <KeyValue key={d} label={t(d)}>{t('Likely')}</KeyValue>)}<KeyValue label={t('Partners')}>{c.partnersCount || t('Unknown')}</KeyValue></div></Card>
        </div>
      </div>
    </AppShell>
  );
}
