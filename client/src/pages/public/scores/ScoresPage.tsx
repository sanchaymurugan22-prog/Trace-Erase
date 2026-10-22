// Public transparency board: which companies actually delete on time.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { PublicNav } from '@/components/layout/PublicNav';
import { Card, Chip, CompanyAvatar, ErrorBox, Icon, ProgressBar, Segmented, Spinner } from '@/components/ui';

const GRADE: Record<string, [string, string]> = {
  'A+': ['var(--color-ok-s)', 'var(--color-ok)'], A: ['var(--color-ok-s)', 'var(--color-ok)'], B: ['var(--color-part-s)', 'var(--color-part)'],
  C: ['var(--color-part-s)', 'var(--color-part)'], D: ['var(--color-leak-s)', 'var(--color-leak)'], F: ['var(--color-leak-s)', 'var(--color-leak)']
};

export default function ScoresPage() {
  const t = useT();
  const { data, error, loading } = useApi<any>('/public/scores');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const all: any[] = data?.rows || [];
  const rows = all.filter(r => (!q || r.company.name.toLowerCase().includes(q.toLowerCase())) && (cat === 'All' || r.company.category === cat));
  const cats = ['All', ...new Set(all.map(r => r.company.category as string))];

  return (
    <div className="min-h-screen bg-bg">
      <section className="dots bg-navy text-on">
        <PublicNav />
        <div className="mx-auto flex max-w-[1320px] flex-col gap-7 px-10 pb-16 pt-12 max-[820px]:px-4">
          <div className="flex max-w-[820px] flex-col gap-4">
            <span className="inline-flex h-8 items-center self-start rounded-full bg-white/10 px-3 text-[13px] font-semibold">{t('Public transparency board')}{data?.includesSample ? ` · ${t('includes sample data')}` : ''}</span>
            <h1 className="text-6xl font-extrabold tracking-tight text-white max-[820px]:text-4xl">{t('Who actually deletes your data?')}</h1>
            <p className="text-lg leading-[30px] text-onm">{t("Grades come from companies' own signed replies, deadlines met or missed, and traced leaks, not from promises. Anyone can check any receipt.")}</p>
            <label className="flex h-14 max-w-[560px] items-center gap-2.5 rounded-2xl bg-white px-4 text-mute">
              <Icon name="search" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search a company, e.g. Swiggy')} aria-label={t('Search a company')} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-navy outline-none" />
            </label>
          </div>
          {data && (
            <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2">
              {[[data.totals.requests.toLocaleString('en-IN'), 'Deletion requests tracked'], [data.totals.provenPct + '%', 'Proven with receipts'], [data.totals.ignoredPct + '%', 'Ignored past the deadline'], [data.totals.leaks.toLocaleString('en-IN'), 'Leaks traced by protected emails']].map(([v, l]) => (
                <div key={l} className="rounded-[18px] border border-white/10 bg-white/6 p-5"><b className="font-display text-[34px] font-extrabold leading-[42px] text-white">{v}</b><div className="text-[13px] text-onm">{t(l)}</div></div>
              ))}
            </div>
          )}
        </div>
      </section>
      <main className="mx-auto flex max-w-[1320px] flex-col gap-6 px-10 pb-16 pt-10 max-[820px]:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[28px] font-bold">{t('Company ranking')}</h2>
          <Segmented value={cat} onChange={setCat} options={cats.map(c => ({ value: c, label: t(c) }))} />
        </div>
        <ErrorBox error={error} />
        {loading ? <Spinner /> : (
          <Card className="gap-0 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>#</th><th>{t('Company')}</th><th>{t('Grade')}</th><th>{t('Deleted on time')}</th><th>{t('Avg. days')}</th><th>{t('Leaks traced')}</th><th>{t('Proof')}</th><th>{t('Data')}</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.company.id}>
                      <td className="text-mute">{i + 1}</td>
                      <td><span className="flex items-center gap-3"><CompanyAvatar company={r.company} size="sm" /><span className="font-bold" translate="no">{r.company.name}</span></span></td>
                      <td><span className="inline-flex size-10 items-center justify-center rounded-xl font-display text-base font-extrabold" style={{ background: GRADE[r.grade]?.[0], color: GRADE[r.grade]?.[1] }}>{r.grade}</span></td>
                      <td><div className="flex min-w-[180px] items-center gap-2"><ProgressBar pct={r.onTime} color={GRADE[r.grade]?.[1]} /><span className="text-sm font-semibold">{r.onTime}%</span></div></td>
                      <td>{r.avgDays ?? t('n/a')}</td>
                      <td className={r.leaks > 10 ? 'font-bold text-leak' : ''}>{r.leaks}</td>
                      <td><Chip tone={r.proof === 'Silence-verified' ? 'ok' : 'neutral'}>{t(r.proof)}</Chip></td>
                      <td>{r.sample ? <Chip>{t('Sample')}</Chip> : <Chip tone="ok">{t('Live')}</Chip>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {data?.includesSample && <p className="text-[13px] text-mute">{t('Rows marked "Sample" use illustrative figures until enough real requests exist for that company. They are not real scores.')}</p>}
      </main>
    </div>
  );
}
