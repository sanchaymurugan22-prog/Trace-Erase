// AI translation of the interface. Strings are translated once per language and cached.
import { db } from '../db.js';
import { generate } from '../ai/gemini.js';
import { languageName } from './letters.js';

const pending = new Map();

export async function translate(lang, strings) {
  if (!lang || lang === 'en') return {};
  let rec = db.find('i18n', r => r.id === 'lang-' + lang) || db.insert('i18n', { id: 'lang-' + lang, map: {} });
  const missing = [...new Set(strings.filter(s => typeof s === 'string' && s.trim() && !(s in rec.map)))].slice(0, 300);
  if (missing.length) {
    const key = lang + ':' + missing.join('|').length;
    if (!pending.has(key)) {
      pending.set(key, (async () => {
        try {
          for (let i = 0; i < missing.length; i += 80) {
            const chunk = missing.slice(i, i + 80);
            const out = await generate({
              feature: 'translate-ui',
              system: `You translate a privacy app's interface text into ${languageName(lang)}. Keep it short and natural, as a native app would. Keep brand names (TraceErase, Zomato, Gmail...), numbers, codes, email addresses and placeholders like {n} unchanged.`,
              prompt: `Translate each string. Return JSON {"t":[...same order, same length...]}.\n${JSON.stringify(chunk)}`,
              json: true, temperature: 0.1, maxTokens: 4000, fast: true
            });
            const arr = out.t || [];
            const fresh = db.find('i18n', r => r.id === 'lang-' + lang);
            chunk.forEach((s, j) => { if (typeof arr[j] === 'string' && arr[j].trim()) fresh.map[s] = arr[j]; });
            db.update('i18n', fresh.id, { map: { ...fresh.map } });
          }
        } catch (e) { if (e.code !== 0) console.warn('[i18n] translation failed:', e.message); }
        finally { pending.delete(key); }
      })());
    }
    await pending.get(key);
    rec = db.find('i18n', r => r.id === 'lang-' + lang);
  }
  const out = {};
  for (const s of strings) if (rec.map[s]) out[s] = rec.map[s];
  return out;
}
