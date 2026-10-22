// Session: the signed-in user (or regulator), server flags and AI status.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearTokens, get, patch, post, setStaffToken } from './api';
import { useI18n } from '@/i18n/I18nProvider';
import type { AiStatus, Flags, Me, Settings, Staff, User } from '@/types/api';

/** What PATCH /api/me accepts; settings are merged with the saved ones. */
export type MePatch = { name?: string; language?: string; letterLanguage?: string; onboarding?: Record<string, any>; settings?: Partial<Settings> & Record<string, any> };

interface SessionValue {
  loading: boolean; user: User | null; staff: Staff | null; flags: Flags; ai: AiStatus;
  refresh: () => Promise<User | null>;
  setUser: (u: User | null) => void;
  setStaff: (s: Staff | null) => void;
  logout: () => Promise<void>;
  logoutStaff: () => Promise<void>;
  updateMe: (body: MePatch) => Promise<User>;
  setLanguage: (code: string) => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);
const noAi: AiStatus = { configured: false, provider: null, model: null, lastOk: null, lastError: null, hint: null };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useI18n();
  const [state, setState] = useState<{ loading: boolean; user: User | null; staff: Staff | null; flags: Flags; ai: AiStatus }>({ loading: true, user: null, staff: null, flags: {}, ai: noAi });

  const refresh = useCallback(async () => {
    try {
      const me = await get<Me>('/me');
      setState({ loading: false, user: me.user, staff: me.staff, flags: me.flags || {}, ai: me.ai || noAi });
      return me.user;
    } catch {
      setState(s => ({ ...s, loading: false }));
      return null;
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // A signed-in user's saved language wins over this browser's choice
  useEffect(() => { if (state.user?.language && state.user.language !== lang) setLang(state.user.language); }, [state.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setUser = (user: User | null) => setState(s => ({ ...s, user }));
  const setStaff = (staff: Staff | null) => setState(s => ({ ...s, staff }));
  const logout = async () => { await post('/auth/logout').catch(() => {}); clearTokens(); setState(s => ({ ...s, user: null })); };
  const logoutStaff = async () => { await post('/auth/staff/logout').catch(() => {}); setStaffToken(''); setState(s => ({ ...s, staff: null })); };
  const updateMe = async (body: MePatch) => { const r = await patch<{ user: User }>('/me', body); setUser(r.user); return r.user; };
  const setLanguage = async (code: string) => {
    setLang(code);
    if (state.user) await updateMe({ language: code }).catch(() => {});
  };

  // Appearance settings
  useEffect(() => {
    const st = state.user?.settings;
    const dark = st?.theme === 'dark' || (st?.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.textSize = st?.textSize || 'default';
  }, [state.user]);

  return (
    <Ctx.Provider value={{ ...state, refresh, setUser, setStaff, logout, logoutStaff, updateMe, setLanguage }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
