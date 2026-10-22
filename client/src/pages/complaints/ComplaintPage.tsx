// A complaint to the Data Protection Board: drafted by AI from the evidence, reviewed and filed by the user.
import { useEffect, useState } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { openApiPage, patch, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ActionButton, AiTag, Banner, Card, Check, Chip, CompanyAvatar, ErrorBox, Icon, Input, PageLoading, Textarea, Tile, Timeline, buttonClass, useToast } from '@/components/ui';
import type { Complaint } from '@/types/api';

const NEXT = [
  ['Filed with the Board', 'You get a reference number'],
  ['The Board reviews your evidence', 'It is already fingerprinted, so no extra paperwork'],
  ['Companies must respond', 'Penalties under the DPDP Act go up to ₹250 crore'],
  ['We track it for you', 'Updates appear in Alerts']
];

export default function ComplaintPage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const toast = useToast();
  const { data: c, loading, error, setData } = useApi<Complaint>('/complaints/' + params.id);
  const [summary, setSummary] = useState('');
  const [asks, setAsks] = useState<string[]>([]);
  const [agree, setAgree] = useState(true);
  useEffect(() => { if (c) { setSummary(c.summary); setAsks(c.asks || []); } }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <AppShell active="/app/evidence"><PageLoading /></AppShell>;
  if (error || !c) return <AppShell active="/app/evidence"><ErrorBox error={error} /></AppShell>;
  const filed = c.status === 'filed';
  const file = async () => {
    const r = await post<Complaint>(`/complaints/${c.id}/file`, { summary, asks });
    setData({ ...c, ...r });
    toast(t('Complaint {ref} filed', { ref: r.reference || '' }));
  };

  return (
    <AppShell active="/app/evidence">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">{filed ? t('Complaint {ref}', { ref: c.reference || '' }) : t('Review your complaint')}</h1>
          <p className="text-mute">{filed
            ? (c.autoFiled ? t('Filed automatically on {date}.', { date: fmtDateTime(c.filedAt) }) : t('Filed on {date}.', { date: fmtDateTime(c.filedAt) }))
            : t('Drafted by AI from your evidence. Nothing is filed until you approve it.')}</p>
        </div>
        <button type="button" className={buttonClass('secondary')} onClick={() => openApiPage(`/api/docs/complaint/${c.id}`).catch(e => toast(t(e.message), 'err'))}><Icon name="download" />{t('Save as PDF')}</button>
      </div>

      {filed && (
        <Banner tone="ok" icon="check">
          <span className="text-sm">{t("Filed and recorded with a ledger fingerprint. In this prototype it reaches the regulator console; download the PDF to submit it on the Board's official portal too.")}</span>
        </Banner>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="gap-6 p-8">
          <div className="flex items-center gap-4">
            <Tile icon="scale" tone="neutral" size="lg" />
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] text-mute">{t('To')}</span>
              <span className="text-xl font-bold">{t(c.to)}</span>
              <span className="text-[13px] text-mute">{t('Under the Digital Personal Data Protection Act, 2023')}</span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t('Against')}</span>
            {c.parties.map(p => (
              <div key={p.name} className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3">
                <CompanyAvatar company={{ name: p.name, color: 'k7' }} size="sm" />
                <span className="flex flex-col"><span className="text-sm font-bold" translate="no">{p.name}</span><span className="text-[13px] text-mute">{t(p.issue)}</span></span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between"><label htmlFor="summary" className="text-sm font-semibold">{t('What happened')}</label><AiTag ai={c.ai} label={t('Drafted by AI')} /></div>
            <Textarea id="summary" rows={8} value={summary} disabled={filed} onChange={e => setSummary(e.target.value)}
              onBlur={() => { if (!filed) patch(`/complaints/${c.id}`, { summary }).catch(() => {}); }} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t('I ask the Board to')}</span>
            {asks.map((a, i) => (
              <label key={i} className="flex items-center gap-3">
                <Chip className="min-w-7 justify-center">{i + 1}</Chip>
                <Input className="h-11" value={a} disabled={filed} aria-label={t('Request {n}', { n: i + 1 })}
                  onChange={e => setAsks(asks.map((x, j) => (j === i ? e.target.value : x)))}
                  onBlur={() => { if (!filed) patch(`/complaints/${c.id}`, { asks }).catch(() => {}); }} />
              </label>
            ))}
          </div>

          {c.pack && (
            <Link to={`/app/evidence/${c.pack.id}`} className="flex items-center gap-3 rounded-2xl bg-soft p-4 text-ink hover:text-ink">
              <Tile icon="file" tone="accent" />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">{t('Evidence pack {number}', { number: c.pack.number })}</span><span className="text-[13px] text-mute">{t('{n} records, all fingerprinted', { n: c.pack.items.length })}</span></span>
              <Chip tone="ok" icon="check">{t('Attached')}</Chip>
            </Link>
          )}

          {!filed && (
            <>
              <Check checked={agree} onChange={e => setAgree(e.target.checked)} label={<span className="text-sm">{t('I confirm these facts are true and want this complaint filed in my name.')}</span>} />
              <ActionButton size="lg" disabled={!agree} onClick={file}><Icon name="send" />{t('File complaint')}</ActionButton>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold">{t('What happens next')}</h2>
          <Timeline items={NEXT.map(([h, s], i) => ({
            icon: filed && i === 0 ? 'check' : i === 0 ? 'send' : i === 1 ? 'search' : i === 2 ? 'scale' : 'bell',
            state: filed && i === 0 ? 'done' : i === (filed ? 1 : 0) ? 'current' : 'todo',
            title: <span className="text-sm font-semibold">{t(h)}</span>,
            sub: <span className="text-[13px] text-mute">{t(s)}</span>
          }))} />
        </Card>
      </div>
    </AppShell>
  );
}
