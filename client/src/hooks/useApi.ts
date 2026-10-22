import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from '@/lib/api';

/** Load data from the API. Returns { data, error, loading, reload, setData }. */
export function useApi<T = any>(path: string | null, { interval = 0 }: { interval?: number } = {}) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: !!path });
  const alive = useRef(true);
  const load = useCallback(async (quiet = false) => {
    if (!path) return;
    if (!quiet) setState(s => ({ ...s, loading: !s.data }));
    try {
      const data = await get<T>(path);
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (error: any) {
      if (alive.current) setState(s => ({ ...s, error, loading: false }));
    }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    load();
    let timer: number | undefined;
    if (interval) timer = window.setInterval(() => load(true), interval);
    // Demo controls broadcast this after moving the clock or delivering a message
    const onRefresh = () => load(true);
    window.addEventListener('te:refresh', onRefresh);
    return () => { alive.current = false; window.clearInterval(timer); window.removeEventListener('te:refresh', onRefresh); };
  }, [load, interval]);
  return {
    ...state,
    reload: () => load(true),
    setData: (d: T | ((prev: T | null) => T)) => setState(s => ({ ...s, data: typeof d === 'function' ? (d as (p: T | null) => T)(s.data) : d }))
  };
}
