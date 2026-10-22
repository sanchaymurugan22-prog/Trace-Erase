// Onboarding step 4: results of the scan, and choosing what to delete first.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { agoParts, cn } from '@/lib/format';
import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Button, ButtonLink, Card, Chip, CompanyAvatar, DarkPanel, Icon, Segmented, Spinner, Tile } from '@/components/ui';
import type { HoldingRow } from '@/types/api';

export default function ResultsPage() {
  const navigate = useNavigate();
  const t = useT();
  const { data: scan } = useApi<any>('/scan/latest');
  const { data: rows, loading } = useApi<HoldingRow[]>('/companies');
  const [cat, setCat] = useState('All');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const list = rows || [];
  const cats = useMemo(() => {
    const m: Record<string, number> = {};
    list.forEach(r => { m[r.company.category] = (m[r.company.category] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [list]);
  const shown = list.filter(r => cat === 'All' || r.company.category === cat);
  useEffect(() => { if (rows && !sel.size) setSel(new Set(rows.filter(r => (r.daysSinceUse ?? 0) > 365).slice(0, 6).map(r => r.id))); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const s = scan?.summary;
  const seen = (iso: string | null) => { const [tpl, n] = agoParts(iso); return iso ? t('last seen {when}', { when: t(tpl, { n }).toLowerCase() }) : t('found'); };

  return (
    <div className="min-h-screen bg-bg">
      <OnboardingHeader step="results" />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-7 p-10 max-[820px]:px-4">
        <DarkPanel className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-10 p-10 max-[1000px]:grid-cols-1">
          <div className="flex flex-col gap-4">
            <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-white/10 px-2.5 text-[13px] font-semibold"><Icon name="check" size="sm" className="text-accent-b" />{t('Scan complete')}</span>
            <h1 className="text-5xl font-extrabold tracking-tight text-white max-[820px]:text-3xl">{t('{n} companies have your data.', { n: list.length })}</h1>
            {s?.headline && <div className="flex items-start gap-3 rounded-2xl border border-accent-b/25 bg-accent-b/10 p-4"><Icon name="sparkle" className="mt-0.5 text-accent-b" /><span className="text-on">{t(s.headline)}</span></div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[[s?.unused ?? '–', 'Not used in a year'], [s?.sharing ?? '–', 'Share with partners'], [list.filter(r => r.channel === 'webform').length, 'Need a web form'], [cats.length, 'Categories']].map(([v, l]) => (
              <div key={l as string} className="rounded-[18px] border border-white/8 bg-white/6 px-5 py-[18px]"><b className="font-display text-[32px] font-extrabold leading-10 text-white">{v}</b><div className="text-[13px] text-onm">{t(l as string)}</div></div>
            ))}
          </div>
        </DarkPanel>

        <Segmented className="self-start" value={cat} onChange={setCat} options={[{ value: 'All', label: `${t('All')} ${list.length}` }, ...cats.map(([c, n]) => ({ value: c, label: `${t(c)} ${n}` }))]} />

        {loading ? <Spinner /> : (
          <div className="grid grid-cols-3 gap-5 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
            {shown.map(r => (
              <Card key={r.id} className={cn('gap-3 p-5', sel.has(r.id) && 'border-[#9FB4F3]')}>
                <div className="flex items-center gap-3">
                  <CompanyAvatar company={r.company} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link to={`/app/companies/${r.id}`} className="text-[17px] font-bold text-ink" translate="no">{r.company.name}</Link>
                    <span className="text-[13px] text-mute">{t(r.company.category)} · {seen(r.lastSeen)}</span>
                  </span>
                  <input className="checkbox" type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={t('Select {name}', { name: r.company.name })} />
                </div>
                <div className="flex flex-wrap gap-1">{(r.dataTypes || []).slice(0, 4).map(d => <Chip key={d} className="h-6 text-xs">{t(d)}</Chip>)}</div>
                <div className="flex items-center justify-between">
                  <Chip tone={r.partnersCount >= 3 ? 'nr' : r.partnersCount ? 'part' : 'ok'} icon="share">{r.partnersCount ? t('Shares with {n}', { n: r.partnersCount }) : t('Shares with none')}</Chip>
                  <Chip>{t(r.channel === 'webform' ? 'Web form' : 'Email')}</Chip>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="sticky bottom-4 flex-row flex-wrap items-center justify-between gap-4 px-6 py-5 shadow-pop">
          <span className="flex items-center gap-3"><Tile icon="trash" /><span className="flex flex-col"><span className="text-[17px] font-bold">{t('{n} selected', { n: sel.size })}</span><span className="text-[13px] text-mute">{t("We'll also ask every partner they name in their reply")}</span></span></span>
          <div className="flex gap-2">
            <ButtonLink to="/app" variant="secondary" size="lg">{t('Decide later')}</ButtonLink>
            <Button size="lg" disabled={!sel.size} onClick={() => navigate('/app/delete?ids=' + [...sel].join(','))}>{t('Delete from selected')}<Icon name="ar" /></Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
