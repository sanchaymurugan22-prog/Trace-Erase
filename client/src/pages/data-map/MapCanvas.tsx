// The drawing: You → companies → their partners → leaks.
import { useMemo } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';

export const STATUS_COLOR: Record<string, string> = { verified: '#127A3E', partial: '#8A5A00', claimed: '#1D4ED8', overdue: '#B3361B', 'no-response': '#A3470A', sent: '#4A5568', 'not-asked': '#94A3B8' };
export type Selection = { type: 'company' | 'partner'; id: string } | null;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function MapCanvas({ data, filter, sel, onSelect }: { data: any; filter: string; sel: Selection; onSelect: (s: Selection) => void }) {
  const t = useT();
  const L = useMemo(() => {
    const W = 900, H = 560;
    const companies = filter === 'shared' ? data.companies.filter((c: any) => data.edges.some((e: any) => e.from === c.id))
      : filter === 'leaks' ? data.companies.filter((c: any) => data.leaks.some((l: any) => l.from === c.id || data.edges.some((e: any) => e.from === c.id && e.to === l.from)))
      : data.companies;
    const spread = (n: number, i: number) => (n === 1 ? H / 2 : 70 + i * ((H - 140) / (n - 1)));
    const cPos: Record<string, { y: number }> = Object.fromEntries(companies.map((c: any, i: number) => [c.id, { y: spread(companies.length, i) }]));
    const partners = data.partners.filter((p: any) => data.edges.some((e: any) => e.to === p.id && cPos[e.from]));
    const pPos: Record<string, { y: number }> = Object.fromEntries(partners.map((p: any, i: number) => [p.id, { y: spread(partners.length, i) }]));
    const leaks = data.leaks.map((l: any) => ({ ...l, y: (pPos[l.from] || cPos[l.from] || { y: H / 2 }).y })).filter((l: any) => pPos[l.from] || cPos[l.from]);
    return { W, H, companies, partners, cPos, pPos, leaks };
  }, [data, filter]);

  const node = (x: number, y: number, w: number, name: string, status: string, on: boolean, n: number) => (
    <>
      {on && <rect x={x - 6} y={y - 28} width={w + 12} height="56" rx="16" fill="var(--color-brand-s)" />}
      <rect x={x} y={y - 22} width={w} height="44" rx="12" fill="var(--color-card)" stroke={on ? 'var(--color-brand)' : 'var(--color-line2)'} strokeWidth={on ? 2 : 1} />
      <circle cx={x + 20} cy={y} r="6" fill={STATUS_COLOR[status] || '#94A3B8'} />
      <text x={x + 34} y={y + 5} fontFamily="Inter" fontWeight="600" fontSize="14" fill="var(--color-ink)">{cut(name, n)}</text>
    </>
  );

  return (
    <svg viewBox={`0 0 ${L.W} ${L.H}`} width="100%" role="img" aria-label={t('Map of companies and partners holding your data')} className="block">
      <defs><pattern id="dg" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--color-line)" /></pattern></defs>
      <rect width={L.W} height={L.H} rx="16" fill="url(#dg)" />
      {L.companies.map((c: any) => <path key={'e' + c.id} d={`M124 ${L.H / 2}C190 ${L.H / 2} 200 ${L.cPos[c.id].y} 260 ${L.cPos[c.id].y}`} fill="none" stroke="var(--color-line2)" strokeWidth="2" />)}
      {data.edges.filter((e: any) => L.cPos[e.from] && L.pPos[e.to]).map((e: any, i: number) => {
        const a = L.cPos[e.from], b = L.pPos[e.to];
        return <path key={'p' + i} d={`M400 ${a.y}C460 ${a.y} 460 ${b.y} 520 ${b.y}`} fill="none" stroke={e.kind === 'ignored' ? '#A3470A' : 'var(--color-line2)'} strokeWidth={e.kind === 'ignored' ? 2.5 : 2} />;
      })}
      {L.leaks.map((l: any) => <path key={'l' + l.id} d={`M${L.pPos[l.from] ? 680 : 400} ${l.y}H740`} fill="none" stroke="#B42318" strokeWidth="2.5" strokeDasharray="6 5" />)}
      <circle cx="80" cy={L.H / 2} r="50" fill="var(--color-brand-s)" /><circle cx="80" cy={L.H / 2} r="40" fill="#0A1630" />
      <text x="80" y={L.H / 2 + 6} textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="17" fill="#fff">{t('You')}</text>
      {L.companies.map((c: any) => (
        <g key={c.id} className="cursor-pointer" role="button" tabIndex={0} aria-label={c.name} onClick={() => onSelect({ type: 'company', id: c.id })} onKeyDown={e => e.key === 'Enter' && onSelect({ type: 'company', id: c.id })}>
          {node(260, L.cPos[c.id].y, 140, c.name, c.status, sel?.id === c.id, 13)}
        </g>
      ))}
      {L.partners.map((p: any) => (
        <g key={p.id} className="cursor-pointer" role="button" tabIndex={0} aria-label={p.name} onClick={() => onSelect({ type: 'partner', id: p.id })} onKeyDown={e => e.key === 'Enter' && onSelect({ type: 'partner', id: p.id })}>
          {node(520, L.pPos[p.id].y, 160, p.name, p.status, sel?.id === p.id, 15)}
        </g>
      ))}
      {L.leaks.map((l: any) => (
        <Link key={l.id} to={`/app/leaks/${l.id}`}>
          <g className="cursor-pointer">
            <rect x="740" y={l.y - 22} width="150" height="44" rx="12" fill="var(--color-leak-s)" stroke="#B42318" strokeWidth="1.5" />
            <text x="815" y={l.y + 5} textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="14" fill="#B42318">{cut(l.name, 14)}</text>
            <text x="815" y={l.y + 40} textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="11" fill="#B42318">{t('LEAK')}</text>
          </g>
        </Link>
      ))}
      <g fontFamily="Inter" fontSize="11" fontWeight="700" fill="var(--color-mute)">
        <text x="330" y="30" textAnchor="middle">{t('COMPANIES')}</text><text x="600" y="30" textAnchor="middle">{t('THEIR PARTNERS')}</text>
        {L.leaks.length > 0 && <text x="815" y="30" textAnchor="middle">{t('NEVER GIVEN')}</text>}
      </g>
      {data.more > 0 && <text x="330" y={L.H - 14} textAnchor="middle" fontFamily="Inter" fontSize="13" fill="var(--color-mute)">{t('+ {n} more companies', { n: data.more })}</text>}
    </svg>
  );
}
