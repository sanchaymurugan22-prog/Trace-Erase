// Time. Real accounts always use the real clock. Each demo account has its own "demo clock" that
// judges can move forward to watch reminders, grievances and complaints happen, without touching
// anyone else's deadlines. The current account's clock rides along with each request (AsyncLocalStorage).
import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from '../db.js';

export const clockCtx = new AsyncLocalStorage();

const offsetMs = () => clockCtx.getStore()?.offsetMs || 0;
const offsetFor = (user) => (user?.demo ? user.clockOffsetMs || 0 : 0);

/** Use this account's clock for the rest of the current request or job. */
export function useClockOf(user) {
  const st = clockCtx.getStore();
  if (st) { st.offsetMs = offsetFor(user); st.userId = user?.id; }
}
/** Run fn with an account's clock (for background jobs that go through many accounts). */
export const withClockOf = (user, fn) => clockCtx.run({ offsetMs: offsetFor(user), userId: user?.id }, fn);

export const now = () => new Date(Date.now() + offsetMs());
export const nowIso = () => now().toISOString();
export const offsetDays = () => Math.round(offsetMs() / 86400000);

/** Demo accounts only: move this account's clock forward. */
export function advanceDays(user, days) {
  if (!user?.demo) return 0;
  const ms = (user.clockOffsetMs || 0) + days * 86400000;
  db.update('users', user.id, { clockOffsetMs: ms });
  const st = clockCtx.getStore();
  if (st && st.userId === user.id) st.offsetMs = ms;
  return Math.round(ms / 86400000);
}
export function resetClock(user) {
  if (!user?.demo) return;
  db.update('users', user.id, { clockOffsetMs: 0 });
  const st = clockCtx.getStore();
  if (st && st.userId === user.id) st.offsetMs = 0;
}
export const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
export const addDays = (iso, d) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();
