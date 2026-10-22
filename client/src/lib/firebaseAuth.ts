// Firebase Authentication over its REST API (no SDK needed): email + password accounts, email
// confirmation links, password reset, and "Continue with Google" (Google Identity Services).
// The Firebase ID token is handed to our server once, which checks it and starts a TraceErase session.
import { FIREBASE, GOOGLE_CLIENT_ID } from './config';
import { post } from './api';
import type { User } from '@/types/api';

const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: 'An account with this email already exists. Please log in instead.',
  INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.',
  INVALID_PASSWORD: 'Wrong email or password.',
  EMAIL_NOT_FOUND: 'Wrong email or password.',
  USER_DISABLED: 'This account has been switched off.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Please wait a few minutes and try again.',
  WEAK_PASSWORD: 'Please choose a password with at least 8 characters.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  MISSING_PASSWORD: 'Please enter your password.',
  OPERATION_NOT_ALLOWED: 'This way of signing in is not switched on in Firebase yet.',
  TOKEN_EXPIRED: 'Your sign-in expired. Please log in again.',
  INVALID_ID_TOKEN: 'Your sign-in expired. Please log in again.',
  USER_NOT_FOUND: 'Your sign-in expired. Please log in again.'
};

// On Firebase Hosting the exact web config is served at /__/firebase/init.json; prefer it over the typed copy
let keyPromise: Promise<string> | null = null;
function apiKey(): Promise<string> {
  keyPromise ||= fetch('/__/firebase/init.json')
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j && typeof j.apiKey === 'string' && j.apiKey) || FIREBASE.apiKey)
    .catch(() => FIREBASE.apiKey);
  return keyPromise;
}

async function call(base: string, op: string, body: Record<string, unknown>, form = false) {
  if (!FIREBASE.apiKey) throw new Error('Sign-in is not set up on this website yet.');
  const key = await apiKey();
  let r: Response;
  try {
    r = await fetch(`${base}/${op}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body)
    });
  } catch { throw new Error('No internet connection. Please try again.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = String(j?.error?.message || '').split(/[ :]/)[0];
    throw new Error(MESSAGES[code] || j?.error?.message || 'Sign-in failed. Please try again.');
  }
  return j;
}

// While someone confirms their email, we keep the refresh token for this tab only
const PENDING = 'te_fb_pending';
type Pending = { refreshToken: string; email: string };
const savePending = (p: Pending) => { try { sessionStorage.setItem(PENDING, JSON.stringify(p)); } catch {} };
export const pendingEmail = (): Pending | null => { try { return JSON.parse(sessionStorage.getItem(PENDING) || 'null'); } catch { return null; } };
const clearPending = () => { try { sessionStorage.removeItem(PENDING); } catch {} };

/** Our server checks the Firebase token and returns the TraceErase account. */
async function exchange(idToken: string, extra: { name?: string; phone?: string; language?: string } = {}) {
  const r = await post<{ user: User; token: string }>('/auth/firebase', { idToken, ...extra });
  return r.user;
}

const sendVerification = (idToken: string) => call(FIREBASE.authBase, 'accounts:sendOobCode', {
  requestType: 'VERIFY_EMAIL', idToken, continueUrl: `${location.origin}/signup/check-email?confirmed=1`
}).catch(() => call(FIREBASE.authBase, 'accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken }));

export async function signUpWithEmail(f: { name: string; email: string; password: string; phone?: string; language?: string }) {
  const j = await call(FIREBASE.authBase, 'accounts:signUp', { email: f.email.trim(), password: f.password, returnSecureToken: true });
  await call(FIREBASE.authBase, 'accounts:update', { idToken: j.idToken, displayName: f.name.trim(), returnSecureToken: false }).catch(() => {});
  await sendVerification(j.idToken);
  savePending({ refreshToken: j.refreshToken, email: f.email.trim() });
  return exchange(j.idToken, { name: f.name, phone: f.phone, language: f.language });
}

export async function logInWithEmail(email: string, password: string) {
  const j = await call(FIREBASE.authBase, 'accounts:signInWithPassword', { email: email.trim(), password, returnSecureToken: true });
  const user = await exchange(j.idToken);
  if (!user.verified) savePending({ refreshToken: j.refreshToken, email: email.trim() });
  return user;
}

/** After the person clicks the link in the email: get a fresh token (which now says "verified"). */
export async function checkEmailConfirmed() {
  const p = pendingEmail();
  if (!p) throw new Error('Please log in again to continue.');
  const j = await call(FIREBASE.tokenBase, 'token', { grant_type: 'refresh_token', refresh_token: p.refreshToken }, true);
  const user = await exchange(j.id_token);
  if (user.verified) clearPending();
  return user;
}

export async function resendConfirmation() {
  const p = pendingEmail();
  if (!p) throw new Error('Please log in again to continue.');
  const j = await call(FIREBASE.tokenBase, 'token', { grant_type: 'refresh_token', refresh_token: p.refreshToken }, true);
  await sendVerification(j.id_token);
}

export const sendPasswordReset = (email: string) =>
  call(FIREBASE.authBase, 'accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email: email.trim() });

// ---------- Google (Google Identity Services) ----------
declare global { interface Window { google?: any } }
let gisLoading: Promise<void> | null = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ||= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error('Could not load Google sign-in. Check your internet connection.')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Load Google's script early so its pop-up opens straight from the click (browsers block late pop-ups). */
export const preloadGoogle = () => { if (GOOGLE_CLIENT_ID) loadGis().catch(() => {}); };

export const googleEnabled = () => !!(GOOGLE_CLIENT_ID && FIREBASE.apiKey);

/** Opens Google's pop-up and returns a short-lived access token for the given scopes. */
export async function googleAccessToken(scope: string, hint?: string): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not set up on this website yet.');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope, hint, prompt: '',
      callback: (r: any) => {
        if (r.error) return reject(new Error(r.error === 'access_denied' ? 'Google access was not allowed.' : r.error_description || r.error));
        if (scope.includes('gmail') && !window.google.accounts.oauth2.hasGrantedAllScopes(r, scope.split(' ').find((s: string) => s.includes('gmail')))) return reject(new Error('Please tick "View your email message metadata" so we can read who emails you.'));
        resolve(r.access_token);
      },
      error_callback: (e: any) => reject(new Error(e?.type === 'popup_closed' ? 'The Google window was closed.' : e?.type === 'popup_failed_to_open' ? 'Your browser blocked the Google pop-up. Please allow pop-ups for this site.' : 'Google sign-in failed.'))
    });
    client.requestAccessToken();
  });
}

export async function continueWithGoogle(language?: string) {
  const accessToken = await googleAccessToken('openid email profile');
  const j = await call(FIREBASE.authBase, 'accounts:signInWithIdp', {
    postBody: `access_token=${accessToken}&providerId=google.com`, requestUri: location.origin, returnSecureToken: true, returnIdpCredential: true
  });
  return exchange(j.idToken, { name: j.displayName || j.fullName, language });
}

/** Read-only Gmail access for the inbox scan (only who emailed you and the subject line). */
export const gmailAccessToken = (hint?: string) => googleAccessToken('https://www.googleapis.com/auth/gmail.metadata', hint);
