// Dev outbox: every email and SMS TraceErase sent or prepared. Real delivery needs SMTP / Twilio in server/.env.
import { Fragment, useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { copyText, fmtDateTime } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { Banner, Button, Card, Chip, EmptyState, Icon, PageLoading, useToast } from '@/components/ui';
import type { OutboxItem } from '@/types/api';

export default function OutboxPage() {
  const t = useT();
  const toast = useToast();
  const { data, loading } = useApi<OutboxItem[]>('/outbox', { interval: 8000 });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <AppShell active="/app/settings">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-extrabold tracking-tight">{t('Dev outbox')}</h1>
        <p className="text-mute">{t('Every email and SMS TraceErase sent or prepared. Click a row to read it.')}</p>
      </div>
      <Banner tone="info" icon="info">
        <span className="text-sm">{t('Deletion letters are not emailed to real companies unless SEND_REAL_REQUESTS=true and an email service (SMTP) is set in server/.env. Until then, copy a letter from here and send it yourself.')}</span>
      </Banner>
      {loading ? <PageLoading /> : !data?.length ? <Card><EmptyState icon="mail" title="Nothing sent yet" /></Card> : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('When')}</th><th>{t('Type')}</th><th>{t('To')}</th><th>{t('Subject or text')}</th><th>{t('Delivery')}</th></tr></thead>
              <tbody>
                {data.map(o => (
                  <Fragment key={o.id}>
                    <tr className="cursor-pointer" onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
                      <td className="whitespace-nowrap text-mute">{fmtDateTime(o.sentAt)}</td>
                      <td><Chip icon={o.channel === 'sms' ? 'chat' : 'mail'}>{t(o.kind)}</Chip></td>
                      <td className="font-mono text-[13px]" translate="no">{o.to}</td>
                      <td className="text-sm"><span className="clamp-2">{o.subject || o.text}</span></td>
                      <td>{o.delivered ? <Chip tone="ok" icon="check">{t('Sent')}</Chip> : <span className="text-[13px] text-mute">{t(o.deliveryNote || 'Held for your review')}</span>}</td>
                    </tr>
                    {open === o.id && (
                      <tr>
                        <td colSpan={5}>
                          <div className="flex flex-col gap-3 rounded-xl bg-soft p-4">
                            {o.from && <span className="text-[13px] text-mute" translate="no">{t('From')} {o.from}</span>}
                            <pre className="m-0 whitespace-pre-wrap font-sans text-sm text-ink2">{o.text}</pre>
                            <Button variant="secondary" size="sm" className="self-start" onClick={() => copyText(`${o.subject ? o.subject + '\n\n' : ''}${o.text}`, (m, k) => toast(t(m), k))}>
                              <Icon name="copy" size="sm" />{t('Copy')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
