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
          <p className="text-mute">{t('Paste a receipt ID (or scan the QR code on a certificate). We check its fingerprint, its Merkle proof and the chain of batches.')}</p>
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
              <span className="font-semibold">{t(data.valid ? 'Valid. This receipt is intact and anchored.' : data.anchored ? 'Check failed: the receipt does not match its anchor.' : 'Intact. Waiting for the next anchoring batch.')}</span>
            </Banner>
            <KeyValue label={t('Receipt')}>{t(data.receipt.title)}</KeyValue>
            <KeyValue label={t('Issued')}>{fmtDateTime(data.receipt.issuedAt)}</KeyValue>
            <KeyValue label={t('Fingerprint')}><span className="break-all rounded-lg bg-soft px-2 py-1 font-mono text-xs" translate="no">{data.receipt.hash}</span></KeyValue>
            {data.batch && <>
              <KeyValue label={t('Batch')}>#{data.batch.number} · {t('{n} receipts', { n: data.batch.size })}</KeyValue>
              <KeyValue label={t('Merkle root')}><span className="font-mono text-xs" translate="no">{shortHash(data.batch.root, 12, 8)}</span></KeyValue>
              <KeyValue label={t('Anchored on')}>{t(data.batch.network)}{data.batch.txHash ? ` · tx ${shortHash(data.batch.txHash)}` : ''}</KeyValue>
              <KeyValue label={t('Checks')}>{t('Intact')} {data.intact ? '✓' : '✗'} · {t('In batch')} {data.inBatch ? '✓' : '✗'} · {t('Chain')} {data.chainOk ? '✓' : '✗'}</KeyValue>
            </>}
          </Card>
        )}
      </main>
    </div>
  );
}
