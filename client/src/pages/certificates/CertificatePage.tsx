// Deletion certificate: the result for every company in one request, verifiable by anyone.
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDate, shortHash } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { openApiPage } from '@/lib/api';
import { ButtonLink, ErrorBox, Icon, LogoMark, PageLoading, StatusChip, buttonClass } from '@/components/ui';
import type { Certificate } from '@/types/api';

export default function CertificatePage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const { data: c, loading, error } = useApi<Certificate>('/certificates/' + params.id);
  if (loading) return <AppShell active="/app/evidence"><PageLoading /></AppShell>;
  if (error || !c) return <AppShell active="/app/evidence"><ErrorBox error={error} /></AppShell>;

  return (
    <AppShell active="/app/evidence">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/app/requests/${c.requestId}`} className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="cl" size="sm" />{t('Back to request')}</Link>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/verify/${c.receiptId}`} variant="secondary"><Icon name="share" />{t('Public verify link')}</ButtonLink>
          <button type="button" className={buttonClass('primary')} onClick={() => openApiPage(`/api/docs/certificate/${c.id}`).catch(() => {})}><Icon name="download" />{t('Save as PDF')}</button>
        </div>
      </div>

      {/* The certificate itself is always printed on white, like paper */}
      <article className="mx-auto w-full max-w-[920px] rounded-lg border border-line2 bg-white p-3.5 text-[#0A1630] shadow-pop">
        <div className="dots-light flex flex-col gap-7 rounded border-[1.5px] border-[#0A1630] px-12 py-11 max-[700px]:px-5 max-[700px]:py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2.5">
              <LogoMark size={40} dark={false} />
              <span className="font-display text-xl font-extrabold tracking-tight" translate="no">Trace<span className="text-[#0B7A6E]">Erase</span></span>
            </span>
            <span className="flex flex-col text-right">
              <span className="font-mono text-sm font-bold">{t('No.')} {c.number}</span>
              <span className="text-[13px] text-[#56627A]">{t('Issued {date}', { date: fmtDate(c.issuedAt, { year: true }) })}</span>
            </span>
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-xs font-bold uppercase tracking-[.12em] text-[#0B7A6E]">{t('Certificate of')}</span>
            <h1 className="m-0 font-display text-[44px] font-extrabold leading-[52px] text-[#0A1630] max-[700px]:text-3xl">{t('Data Deletion')}</h1>
            <p className="max-w-[560px] text-[#56627A]">{t('This certifies the outcome of deletion request {request} under the Digital Personal Data Protection Act, 2023. {done} of {total} companies have answered.', { request: c.request || '', done: c.resolvedCount, total: c.total })}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14.5px]">
              <thead>
                <tr className="border-b border-[#E2E7F0] text-left text-[12.5px] text-[#56627A]">
                  <th className="px-3 py-2.5 font-semibold">{t('Company')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Result')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Kept, and why')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Proof')}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map(r => (
                  <tr key={r.company} className="border-b border-[#E2E7F0] last:border-b-0">
                    <td className="px-3 py-3 font-bold" translate="no">{r.company}</td>
                    <td className="px-3 py-3"><StatusChip status={r.status} short /></td>
                    <td className="px-3 py-3 text-sm text-[#2B3954]">{t(r.kept)}</td>
                    <td className="px-3 py-3">{r.hash ? <code className="rounded-md bg-[#EEF2F9] px-2 py-1 font-mono text-[12.5px] text-[#2B3954]">{shortHash(r.hash)}</code> : <span className="text-[13px] text-[#56627A]">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6 border-t border-[#E2E7F0] pt-6">
            <span className="max-w-[440px] text-sm text-[#56627A]">{t('Verify at {path}. Any change to this certificate breaks the check. The PDF version includes a QR code.', { path: `/verify/${c.receiptId}` })}</span>
            <span className="flex flex-col gap-1 text-right">
              <span className="text-[13px] text-[#56627A]">{t('Certificate fingerprint')}</span>
              <code className="rounded-md bg-[#EEF2F9] px-2 py-1 font-mono text-[12.5px] text-[#2B3954]">{shortHash(c.receipt?.hash, 10, 6)}</code>
            </span>
          </div>
        </div>
      </article>
    </AppShell>
  );
}
