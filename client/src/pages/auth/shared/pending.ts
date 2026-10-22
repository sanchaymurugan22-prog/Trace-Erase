// Remembers a sign-up or log-in in progress (between the form and the code screen).
export interface PendingAuth {
  mode: 'signup' | 'login'; userId: string; identifier?: string; channel?: 'email' | 'phone';
  maskedEmail?: string; maskedPhone?: string; masked?: string; devCodes?: { email?: string; phone?: string };
}
const KEY = 'te_pending_auth';
export const savePending = (p: PendingAuth) => { try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch {} };
export const loadPending = (): PendingAuth | null => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
export const clearPending = () => { try { sessionStorage.removeItem(KEY); } catch {} };
