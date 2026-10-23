// Public receipt verification: anyone can check a receipt ID against the ledger.
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDateTime, shortHash } from '@/lib/format';
import { PublicNav } from '@/components/layout/PublicNav';
import { Banner, Button, Card, ErrorBox, Icon, Input, KeyValue, Spinner } from '@/components/ui';

export default function VerifyReceiptPage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const navigate = useNavigate();
  const [id, setId] = useState(params.id || '');
  const { data, error, loading } = useApi<any>(params.id ? '/verify/' + params.id : null);

  return (
    <div className="min-h-screen bg-bg">
      <div className="dots bg-navy text-on"><PublicNav /></div>
      <main className="mx-auto flex max-w-[760px] flex-col gap-5 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">{t('Verify a receipt')}</h1>
          <p className="text-mute">{t('Every important step of a deletion (your signed request, a company\'s reply, a certificate) gets a receipt with its own code. Paste that code here to check the record is genuine and has not been changed since it was made. Anyone can do this without an account: a company, a lawyer or the Data Protection Board.')}</p>
        </div>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (id.trim()) navigate('/verify/' + encodeURIComponent(id.trim())); }}>
          <Input value={id} onChange={e => setId(e.target.value)} placeholder={t('Receipt ID')} aria-label={t('Receipt ID')} className="font-mono" />
          <Button type="submit" size="lg"><Icon name="shieldc" />{t('Verify')}</Button>
        </form>
        {loading && <Spinner />}
        <ErrorBox error={error} />
        {data && !data.found && <Banner tone="leak" icon="alert">{t('No receipt with this ID exists in this ledger.')}</Banner>}
        {data?.found && (
          <Card className="gap-3.5">
            <Banner tone={data.valid ? 'ok' : data.anchored ? 'leak' : 'info'} icon={data.valid ? 'shieldc' : 'clock'}>
              <span className="font-semibold">{t(data.valid ? 'Genuine. This record has not been changed since it was created.' : data.anchored ? 'Warning: this record was changed after it was created.' : 'Genuine. It will be sealed into the tamper-proof log within a minute.')}</span>
            </Banner>
            <KeyValue label={t('What this record is')}>{t(data.receipt.title)}</KeyValue>
            <KeyValue label={t('Created on')}>{fmtDateTime(data.receipt.issuedAt)}</KeyValue>
            <KeyValue label={t('Unique code of this record')}><span className="break-all rounded-lg bg-soft px-2 py-1 font-mono text-xs" translate="no">{data.receipt.hash}</span></KeyValue>
            {data.batch && <>
              <KeyValue label={t('Sealed in')}>{t('Seal #{n} ({m} records in this seal)', { n: data.batch.number, m: data.batch.size })}</KeyValue>
              <KeyValue label={t('Code of the seal')}><span className="font-mono text-xs" translate="no">{shortHash(data.batch.root, 12, 8)}</span></KeyValue>
              <KeyValue label={t('Kept in')}>{t(String(data.batch.network).replace('TraceErase local ledger', 'TraceErase tamper-proof log'))}{data.batch.txHash ? ` · tx ${shortHash(data.batch.txHash)}` : ''}</KeyValue>
              <KeyValue label={t('Checks')}>{t('Not changed')} {data.intact ? '✓' : '✗'} · {t('Inside its seal')} {data.inBatch ? '✓' : '✗'} · {t('Seals unbroken')} {data.chainOk ? '✓' : '✗'}</KeyValue>
            </>}
          </Card>
        )}
        <Card className="gap-3">
          <h2 className="text-lg font-bold">{t('How this check works')}</h2>
          {[
            ['hash', 'When something happens (you sign a request, a company replies), TraceErase turns that record into a unique code, like a fingerprint. Change even one letter of the record and the code changes completely.'],
            ['cube', 'Every minute, new codes are sealed together, and each seal also includes the seal before it. So an old record cannot be quietly changed later without breaking every seal after it.'],
            ['shieldc', 'This page recalculates the code and checks the seals. If everything matches, the record is genuine. Only the code is stored in the seal, never your personal details.']
          ].map(([ic, txt], i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-ink2"><span className="inline-flex size-8 flex-none items-center justify-center rounded-lg bg-accent-s text-accent"><Icon name={ic as any} size="sm" /></span><span>{t(txt)}</span></div>
          ))}
        </Card>
      </main>
    </div>
  );
}
