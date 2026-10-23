// The drawing: You → companies → their partners (named in replies, or the kinds their policy names) → leaks.
import { useMemo } from 'react';
import { Link } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';

export const STATUS_COLOR: Record<string, string> = { verified: '#127A3E', partial: '#8A5A00', claimed: '#1D4ED8', overdue: '#B3361B', 'no-response': '#A3470A', sent: '#4A5568', 'not-asked': '#94A3B8', likely: '#C4CDDC' };
export type Selection = { type: 'company' | 'partner' | 'kind'; id: string } | null;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const ROW = 62;            // vertical space per box
const X = { you: 90, co: 250, coW: 210, pa: 640, paW: 230, leak: 960, leakW: 170 };

export function MapCanvas({ data, filter, sel, onSelect }: { data: any; filter: string; sel: Selection; onSelect: (s: Selection) => void }) {
  const t = useT();
  const L = useMemo(() => {
    const companies = filter === 'shared' ? data.companies.filter((c: any) => data.edges.some((e: any) => e.from === c.id && e.kind !== 'likely'))
      : filter === 'leaks' ? data.companies.filter((c: any) => data.leaks.some((l: any) => l.from === c.id || data.edges.some((e: any) => e.from === c.id && e.to === l.from)))
      : data.companies;
    const showKinds = filter === 'all';
    const partners = data.partners.filter((p: any) => (showKinds || !p.likely) && data.edges.some((e: any) => e.to === p.id && companies.some((c: any) => c.id === e.from)));
    const rows = Math.max(companies.length, partners.length, 5);
    const H = 90 + rows * ROW;
    const W = data.leaks.length ? X.leak + X.leakW + 20 : X.pa + X.paW + 30;
    const spread = (n: number, i: number) => (n === 1 ? H / 2 : 70 + ROW / 2 + i * ((H - 100 - ROW) / Math.max(1, n - 1)));
    const cPos: Record<string, number> = Object.fromEntries(companies.map((c: any, i: number) => [c.id, spread(companies.length, i)]));
    const pPos: Record<string, number> = Object.fromEntries(partners.map((p: any, i: number) => [p.id, spread(partners.length, i)]));
    const edges = data.edges.filter((e: any) => cPos[e.from] != null && pPos[e.to] != null);
    const leaks = data.leaks.map((l: any) => ({ ...l, y: pPos[l.from] ?? cPos[l.from] })).filter((l: any) => l.y != null);
    return { W, H, companies, partners, cPos, pPos, edges, leaks };
  }, [data, filter]);

  const active = sel?.id;
  const linked = (id: string) => !active || id === active || L.edges.some((e: any) => (e.from === active && e.to === id) || (e.to === active && e.from === id));

  const node = (x: number, y: number, w: number, name: string, status: string, on: boolean, dim: boolean, likely = false, sub?: string) => (
    <g opacity={dim ? 0.35 : 1}>
      {on && <rect x={x - 6} y={y - 28} width={w + 12} height="56" rx="16" fill="var(--color-brand-s)" />}
      <rect x={x} y={y - 22} width={w} height="44" rx="12" fill={likely ? 'var(--color-soft)' : 'var(--color-card)'} stroke={on ? 'var(--color-brand)' : 'var(--color-line2)'} strokeWidth={on ? 2 : 1} strokeDasharray={likely ? '5 4' : undefined} />
      <circle cx={x + 20} cy={y} r="6" fill={STATUS_COLOR[status] || '#94A3B8'} />
      <text x={x + 34} y={y + (sub ? -1 : 5)} fontFamily="Inter" fontWeight="600" fontSize="15" fill="var(--color-ink)">{cut(name, Math.floor((w - 44) / 8.4))}</text>
      {sub && <text x={x + 34} y={y + 15} fontFamily="Inter" fontSize="11.5" fill="var(--color-mute)">{sub}</text>}
    </g>
  );

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${L.W} ${L.H}`} width="100%" style={{ minWidth: 760 }} role="img" aria-label={t('Map of companies and partners holding your data')} className="block">
        <defs><pattern id="dg" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--color-line)" /></pattern></defs>
        <rect width={L.W} height={L.H} rx="16" fill="url(#dg)" />
        {L.companies.map((c: any) => (
          <path key={'e' + c.id} d={`M${X.you + 52} ${L.H / 2}C${X.co - 60} ${L.H / 2} ${X.co - 70} ${L.cPos[c.id]} ${X.co} ${L.cPos[c.id]}`} fill="none" stroke="var(--color-line2)" strokeWidth="2" opacity={linked(c.id) ? 1 : 0.3} />
        ))}
        {L.edges.map((e: any, i: number) => {
          const a = L.cPos[e.from], b = L.pPos[e.to];
          const x1 = X.co + X.coW, x2 = X.pa;
          const hot = active && (e.from === active || e.to === active);
          const color = e.kind === 'ignored' ? '#A3470A' : e.kind === 'likely' ? (hot ? 'var(--color-brand)' : '#C4CDDC') : hot ? 'var(--color-brand)' : 'var(--color-line2)';
          return <path key={'p' + i} d={`M${x1} ${a}C${x1 + 90} ${a} ${x2 - 90} ${b} ${x2} ${b}`} fill="none" stroke={color} strokeWidth={e.kind === 'ignored' ? 2.5 : hot ? 2.5 : 1.6} strokeDasharray={e.kind === 'likely' ? '5 5' : undefined} opacity={!active || hot ? 1 : 0.35} />;
        })}
        {L.leaks.map((l: any) => <path key={'l' + l.id} d={`M${L.pPos[l.from] != null ? X.pa + X.paW : X.co + X.coW} ${l.y}H${X.leak}`} fill="none" stroke="#B42318" strokeWidth="2.5" strokeDasharray="6 5" />)}
        <circle cx={X.you} cy={L.H / 2} r="52" fill="var(--color-brand-s)" /><circle cx={X.you} cy={L.H / 2} r="42" fill="#0A1630" />
        <text x={X.you} y={L.H / 2 + 6} textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="18" fill="#fff">{t('You')}</text>
        {L.companies.map((c: any) => (
          <g key={c.id} className="cursor-pointer" role="button" tabIndex={0} aria-label={c.name} onClick={() => onSelect({ type: 'company', id: c.id })} onKeyDown={e => e.key === 'Enter' && onSelect({ type: 'company', id: c.id })}>
            {node(X.co, L.cPos[c.id], X.coW, c.name, c.status, active === c.id, !linked(c.id), false, t(c.category))}
          </g>
        ))}
        {L.partners.map((p: any) => (
          <g key={p.id} className="cursor-pointer" role="button" tabIndex={0} aria-label={p.name} onClick={() => onSelect({ type: p.likely ? 'kind' : 'partner', id: p.id })} onKeyDown={e => e.key === 'Enter' && onSelect({ type: p.likely ? 'kind' : 'partner', id: p.id })}>
            {node(X.pa, L.pPos[p.id], X.paW, p.likely ? t(p.name) : p.name, p.status, active === p.id, !linked(p.id), p.likely, p.likely ? t('Likely · {n} of your companies', { n: p.count }) : t('Named in a reply'))}
          </g>
        ))}
        {L.leaks.map((l: any) => (
          <Link key={l.id} to={`/app/leaks/${l.id}`}>
            <g className="cursor-pointer">
              <rect x={X.leak} y={l.y - 22} width={X.leakW} height="44" rx="12" fill="var(--color-leak-s)" stroke="#B42318" strokeWidth="1.5" />
              <text x={X.leak + X.leakW / 2} y={l.y + 5} textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="14" fill="#B42318">{cut(l.name, 16)}</text>
              <text x={X.leak + X.leakW / 2} y={l.y + 40} textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="11" fill="#B42318">{t('LEAK')}</text>
            </g>
          </Link>
        ))}
        <g fontFamily="Inter" fontSize="12" fontWeight="700" fill="var(--color-mute)" letterSpacing="1">
          <text x={X.co + X.coW / 2} y="34" textAnchor="middle">{t('COMPANIES')}</text>
          <text x={X.pa + X.paW / 2} y="34" textAnchor="middle">{t('THEIR PARTNERS')}</text>
          {L.leaks.length > 0 && <text x={X.leak + X.leakW / 2} y="34" textAnchor="middle">{t('NEVER GIVEN')}</text>}
        </g>
      </svg>
    </div>
  );
}
