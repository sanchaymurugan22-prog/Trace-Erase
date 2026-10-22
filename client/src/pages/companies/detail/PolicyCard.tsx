// AI summary of a company's privacy policy.
import { post } from '@/lib/api';
import { useT } from '@/i18n/I18nProvider';
import { ActionButton, AiCard, AiTag, Icon } from '@/components/ui';

export function PolicyCard({ companyId, policy, onRefreshed }: { companyId: string; policy: any; onRefreshed: () => void }) {
  const t = useT();
  const p = policy || {};
  return (
    <AiCard>
      <div className="flex items-center justify-between">
        <AiTag ai={p._ai} label="AI summary of the privacy policy" />
        <ActionButton variant="ghost" size="sm" aria-label={t('Read the policy again')} onClick={async () => { await post(`/companies/${companyId}/policy/refresh`); onRefreshed(); }}><Icon name="refresh" size="sm" /></ActionButton>
      </div>
      {p.summary && <p className="text-sm text-ink2">{t(p.summary)}</p>}
      <div className="flex flex-col gap-2 text-sm text-ink2">
        {(p.bullets || []).map((b: any, i: number) => (
          <span key={i} className="flex items-start gap-2">
            <Icon name={b.tone === 'good' ? 'check' : b.tone === 'bad' ? 'ban' : 'alert'} size="sm" className={`mt-0.5 ${b.tone === 'good' ? 'text-accent' : b.tone === 'bad' ? 'text-leak' : 'text-nr'}`} />{t(b.text)}
          </span>
        ))}
      </div>
      <span className="text-[13px] text-mute">
        {p.source === 'policy' ? <>{t('Read from')} <a href={p.url} target="_blank" rel="noreferrer">{t('the published policy')}</a></> : p.source === 'knowledge' ? t('Policy page could not be downloaded; based on AI general knowledge') : t('General rules for this kind of company')}
        {p.grievanceEmail ? ` · ${t('contact')} ${p.grievanceEmail}` : ''}
      </span>
    </AiCard>
  );
}
