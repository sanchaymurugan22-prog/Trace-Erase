// A small client-side router built on the History API (no routing dependency).
import { createContext, useCallback, useContext, useEffect, useState, type AnchorHTMLAttributes, type ComponentType, type MouseEvent } from 'react';

interface Location { path: string; search: string; hash: string }
interface RouterValue extends Location { navigate: (to: string | -1, opts?: { replace?: boolean }) => void }

const RouterCtx = createContext<RouterValue | null>(null);
const read = (): Location => ({ path: window.location.pathname, search: window.location.search, hash: window.location.hash });

export function Router({ children }: { children: React.ReactNode }) {
  const [loc, setLoc] = useState<Location>(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const navigate = useCallback((to: string | -1, { replace = false } = {}) => {
    if (to === -1) { window.history.back(); return; }
    if (/^https?:/.test(to)) { window.location.href = to; return; }
    const u = new URL(to, window.location.origin);
    window.history[replace ? 'replaceState' : 'pushState']({}, '', u.pathname + u.search + u.hash);
    setLoc({ path: u.pathname, search: u.search, hash: u.hash });
    if (!u.hash) window.scrollTo(0, 0);
  }, []);
  return <RouterCtx.Provider value={{ ...loc, navigate }}>{children}</RouterCtx.Provider>;
}

export function useRouter() {
  const v = useContext(RouterCtx);
  if (!v) throw new Error('useRouter outside Router');
  return v;
}
export const useNavigate = () => useRouter().navigate;
export const useQuery = (): Record<string, string> => Object.fromEntries(new URLSearchParams(useRouter().search));

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/\/$/, '').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  const m = re.exec(path);
  return m ? Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) : null;
}

export type RouteComponent = ComponentType<{ params: Record<string, string> }>;

/** Render the first route whose pattern matches. */
export function Routes({ routes, fallback: Fallback }: { routes: [string, RouteComponent][]; fallback?: ComponentType }) {
  const { path } = useRouter();
  for (const [pattern, Comp] of routes) {
    const params = matchPath(pattern, path);
    if (params) return <Comp params={params} />;
  }
  return Fallback ? <Fallback /> : null;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean };

export function Link({ to, children, onClick, replace, ...rest }: LinkProps) {
  const navigate = useNavigate();
  const external = /^(https?:|mailto:|tel:)/.test(to) || rest.target === '_blank' || to.startsWith('/api/');
  return (
    <a
      href={to}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (external || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (to.startsWith('#')) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
    >{children}</a>
  );
}
