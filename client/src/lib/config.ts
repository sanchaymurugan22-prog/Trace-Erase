// Build-time settings. All of these are public (they end up in the website's code anyway).
// Local development needs none of them: the API is on the same address through Vite's proxy.
import { ONLINE } from './public-config';

const raw = import.meta.env;
// "npm run deploy:web" builds in "firebase" mode with the public settings in public-config.ts
const online = raw.MODE === 'firebase';
const set = (v: string) => (v && !v.startsWith('PASTE_') ? v : '');
const env: Record<string, any> = online ? {
  ...raw,
  VITE_API_URL: raw.VITE_API_URL || set(ONLINE.apiUrl),
  VITE_FIREBASE_API_KEY: raw.VITE_FIREBASE_API_KEY || set(ONLINE.firebaseApiKey),
  VITE_FIREBASE_PROJECT_ID: raw.VITE_FIREBASE_PROJECT_ID || set(ONLINE.firebaseProjectId),
  VITE_FIREBASE_AUTH_DOMAIN: raw.VITE_FIREBASE_AUTH_DOMAIN || set(ONLINE.firebaseAuthDomain),
  VITE_GOOGLE_CLIENT_ID: raw.VITE_GOOGLE_CLIENT_ID || set(ONLINE.googleClientId)
} : raw;

/** Where the API runs, e.g. https://traceerase-api.onrender.com (empty = same address as the website). */
export const API_URL: string = String(env.VITE_API_URL || '').replace(/\/$/, '');

/** Firebase web config (Authentication). Without it, sign-up uses one-time codes instead. */
export const FIREBASE = {
  apiKey: String(env.VITE_FIREBASE_API_KEY || ''),
  projectId: String(env.VITE_FIREBASE_PROJECT_ID || ''),
  authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN || (env.VITE_FIREBASE_PROJECT_ID ? `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : '')),
  // Tests can point these at a stand-in
  authBase: String(env.VITE_FIREBASE_AUTH_BASE || 'https://identitytoolkit.googleapis.com/v1'),
  tokenBase: String(env.VITE_FIREBASE_TOKEN_BASE || 'https://securetoken.googleapis.com/v1')
};
export const firebaseEnabled = !!FIREBASE.apiKey;

/** Google OAuth web client ID (for "Continue with Google" and the Gmail scan). */
export const GOOGLE_CLIENT_ID: string = String(env.VITE_GOOGLE_CLIENT_ID || '');

/** Scan Gmail directly with Google's permission (needs Google's app verification for the public). */
export const GMAIL_SCAN: boolean = !online || ONLINE.gmailScan;
