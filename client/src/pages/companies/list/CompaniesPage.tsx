// Companies: every company that holds your data.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useQuery } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { agoParts, cn } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { Button, ButtonLink, Card, Chip, CompanyAvatar, EmptyState, ErrorBox, Icon, PageLoading, Segmented, StatusChip } from '@/components/ui';
import type { HoldingRow } from '@/types/api';

type Filter = 'all' | 'shared' | 'unused' | 'real' | 'asked' | 'leaks';
const FILTERS: [Filter, string, (r: HoldingRow) => boolean][] = [
  ['all', 'All', () => true],
  ['shared', 'Shared your data', r => r.partnersCount > 0],
  ['unused', 'Unused 1+ year', r => (r.daysSinceUse ?? 0) > 365],
  ['real', 'Using real email', r => !r.usingProtected && !r.via],
  ['asked', 'Asked to delete', r => r.status !== 'not-asked'],
  ['leaks', 'Leaks', r => r.leaks > 0]
];
const PER_PAGE = 12;

export default function CompaniesPage() {
  const q = useQuery();
  const navigate = useNavigate();
  const t = useT();
  const { data, loading, error, reload } = useApi<HoldingRow[]>('/companies');
  const [filter, setFilter] = useState<Filter>((q.filter as Filter) || 'all');
  const [search, setSearch] = useState(q.q || '');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  useEffect(() => { setSearch(q.q || ''); }, [q.q]);

  const all = data || [];
  const test = FILTERS.find(f => f[0] === filter)![2];
  const rows = all.filter(r => (!search || r.company.name.toLowerCase().includes(search.toLowerCase())) && test(r));
  const pageRows = rows.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ago = (iso: string | null) => { const [tpl, n] = agoParts(iso); return iso ? t(tpl, { n }) : '—'; };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1"><h1 className="text-4xl font-extrabold tracking-tight">{t('Companies')}</h1><p className="text-mute">{t('Every company that holds your data, and how we reach each one.')}</p></div>
        <div className="flex gap-2">
          <ButtonLink to="/app/protect" variant="secondary"><Icon name="plus" />{t('Protect a sign-up')}</ButtonLink>
          <Button disabled={!sel.size} onClick={() => navigate('/app/delete?ids=' + [...sel].join(','))}><Icon name="trash" />{t('Delete selected ({n})', { n: sel.size })}</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={v => { setFilter(v); setPage(0); }} options={FILTERS.map(([k, l, f]) => ({ value: k, label: `${t(l)} ${all.filter(f).length}` }))} />
        <label className="flex h-11 w-64 items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 text-mute">
          <Icon name="search" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder={t('Find a company')} aria-label={t('Find a company')} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
        </label>
      </div>
      <ErrorBox error={error} retry={reload} />
      {loading ? <PageLoading /> : !rows.length ? (
        <Card><EmptyState icon="building" title={all.length ? 'No companies match' : 'No companies yet'} action={!all.length && <ButtonLink to="/onboarding/connect">{t('Run the AI scan')}</ButtonLink>}>{t(all.length ? 'Try another filter.' : 'Scan your inbox to find them.')}</EmptyState></Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-11"><input className="checkbox" type="checkbox" aria-label={t('Select all on this page')} checked={pageRows.every(r => sel.has(r.id))} onChange={e => setSel(s => { const n = new Set(s); pageRows.forEach(r => (e.target.checked ? n.add(r.id) : n.delete(r.id))); return n; })} /></th>
                  <th>{t('Company')}</th><th>{t('Your data')}</th><th>{t('Shared with')}</th><th>{t('How we reach them')}</th><th>{t('Last used')}</th><th>{t('Status')}</th><th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.id}>
                    <td><input className="checkbox" type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={t('Select {name}', { name: r.company.name })} /></td>
                    <td>
                      <Link to={`/app/companies/${r.id}`} className="flex items-center gap-3 text-ink hover:text-ink">
                        <CompanyAvatar company={r.company} size="sm" />
                        <span className="flex flex-col"><span className="font-bold" translate="no">{r.company.name}</span><span className="text-[13px] text-mute">{t(r.company.category)}{r.via ? ` · ${t('via {name}', { name: r.via.name })}` : ''}</span></span>
                      </Link>
                    </td>
                    <td><div className="flex max-w-[220px] flex-wrap gap-1">{(r.dataTypes || []).slice(0, 4).map(d => <Chip key={d} className="h-6 text-xs">{t(d)}</Chip>)}</div></td>
                    <td>{r.partnersCount ? <><b>{r.partnersCount}</b> <span className="text-mute">{t(r.partnersKnown ? 'named by them' : 'per policy')}</span></> : <span className="text-mute">{t('None')}</span>}</td>
                    <td><Chip icon={r.channel === 'webform' ? 'globe' : 'mail'}>{t(r.channel === 'webform' ? 'Web form' : 'Email')}</Chip></td>
                    <td className="text-mute">{ago(r.lastSeen)}</td>
                    <td><div className="flex gap-1"><StatusChip status={r.status} short />{r.leaks > 0 && <StatusChip status="leak" />}</div></td>
                    <td><Link to={`/app/companies/${r.id}`} className="inline-flex size-9 items-center justify-center rounded-xl border border-line text-ink2 hover:bg-soft" aria-label={t('Open {name}', { name: r.company.name })}><Icon name="cr" size="sm" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
            <span className="text-sm text-mute">{t('Showing {a} of {b}', { a: pageRows.length, b: rows.length })}</span>
            <div className="flex gap-1.5">
              {Array.from({ length: Math.ceil(rows.length / PER_PAGE) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} aria-current={i === page ? 'page' : undefined}
                  className={cn('inline-flex size-9 items-center justify-center rounded-[10px] border text-sm font-semibold', i === page ? 'border-brand bg-brand text-white' : 'border-line2 bg-card text-ink hover:bg-soft')}>{i + 1}</button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
