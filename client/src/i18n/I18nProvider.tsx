// Interface translation.
// Every piece of text in the app goes through t('English text'). Built-in dictionaries (src/i18n/locales/*.json)
// translate the whole interface instantly and offline. Text that is not in a dictionary (for example a company's
// reply or an AI summary) is translated by Gemini through /api/i18n when AI is available, and cached in the browser.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { languageByCode } from './languages';
import { setFormatLocale } from '@/lib/format';
import { apiFetch } from '@/lib/api';

type Vars = Record<string, string | number | null | undefined>;
export type TFunction = (text: string, vars?: Vars) => string;

interface I18nValue { lang: string; t: TFunction; setLang: (code: string) => void; ready: boolean; translating: boolean }

const I18nCtx = createContext<I18nValue>({ lang: 'en', t: (s, v) => fill(s, v), setLang: () => {}, ready: true, translating: false });
const STORE = 'te_lang';
const aiKey = (l: string) => `te_ai_i18n_${l}`;

function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** Loads a language dictionary (each language is its own file, loaded only when chosen). */
async function loadDictionary(code: string): Promise<Record<string, string>> {
  if (code === 'en') return {};
  try {
    const mod = await import(`./locales/${code}.json`);
    return (mod.default || mod) as Record<string, string>;
  } catch { return {}; }
}

export const savedLanguage = () => { try { return localStorage.getItem(STORE) || 'en'; } catch { return 'en'; } };
export const hasChosenLanguage = () => { try { return !!localStorage.getItem(STORE); } catch { return false; } };

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(savedLanguage);
  const [dict, setDict] = useState<Record<string, string>>({});
  const [ai, setAi] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(lang === 'en');
  const [translating, setTranslating] = useState(false);
  const pending = useRef(new Set<string>());
  const tried = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);

  // Load the dictionary and the AI cache whenever the language changes
  useEffect(() => {
    let alive = true;
    setReady(lang === 'en');
    loadDictionary(lang).then(d => { if (alive) { setDict(d); setReady(true); } });
    try { setAi(JSON.parse(localStorage.getItem(aiKey(lang)) || '{}')); } catch { setAi({}); }
    pending.current.clear();
    const l = languageByCode(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = l.rtl ? 'rtl' : 'ltr';
    setFormatLocale(lang);
    return () => { alive = false; };
  }, [lang]);

  // Ask the server (Gemini) for anything the dictionary does not cover
  const flush = useCallback(async () => {
    const strings = [...pending.current].slice(0, 120);
    if (!strings.length || lang === 'en') return;
    strings.forEach(s => { pending.current.delete(s); tried.current.add(lang + '\u0000' + s); });
    setTranslating(true);
    try {
      const r = await apiFetch('/api/i18n', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, strings }) });
      const out: Record<string, string> = r.ok ? await r.json() : {};
      if (Object.keys(out).length) {
        setAi(prev => {
          const next = { ...prev, ...out };
          try { localStorage.setItem(aiKey(lang), JSON.stringify(next)); } catch {}
          return next;
        });
      }
    } catch { /* offline: keep English */ }
    finally { setTranslating(false); if (pending.current.size) timer.current = window.setTimeout(flush, 400); }
  }, [lang]);

  const t = useCallback<TFunction>((text, vars) => {
    if (text == null) return '';
    const s = String(text);
    if (lang === 'en' || !s.trim()) return fill(s, vars);
    const hit = dict[s] ?? ai[s];
    if (hit) return fill(hit, vars);
    if (ready && /\p{L}{2,}/u.test(s) && s.length < 600 && !tried.current.has(lang + '\u0000' + s)) {
      pending.current.add(s);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 300);
    }
    return fill(s, vars);
  }, [lang, dict, ai, ready, flush]);

  const setLang = useCallback((code: string) => {
    try { localStorage.setItem(STORE, code); } catch {}
    setLangState(code);
  }, []);

  const value = useMemo(() => ({ lang, t, setLang, ready, translating }), [lang, t, setLang, ready, translating]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
export const useT = () => useContext(I18nCtx).t;
