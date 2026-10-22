// Settings read from client/.env.production (see src/lib/config.ts)
interface ImportMetaEnv {
  readonly MODE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_AUTH_BASE?: string;
  readonly VITE_FIREBASE_TOKEN_BASE?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly [key: string]: string | boolean | undefined;
}
interface ImportMeta { readonly env: ImportMetaEnv }
