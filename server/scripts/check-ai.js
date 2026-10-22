// Finds a Gemini model that works with the key in server/.env and saves it there.
// Run: npm run check:ai
import { config, ENV_FILE, DEFAULT_MODELS } from '../src/config.js';
import { endpoints, explain } from '../src/ai/gemini.js';
import { updateEnvFile } from '../src/util/env.js';

const key = config.geminiKey;
const say = (s = '') => console.log('  ' + s);
console.log('');
if (!key) {
  say('No GEMINI_API_KEY in server/.env. The app will use built-in rules instead of AI.');
  say('Get a free key at https://aistudio.google.com/apikey and run "bash start.command" again.\n');
  process.exit(1);
}
say(`Checking your Gemini key (${key.slice(0, 4)}…${key.slice(-4)}) …\n`);

async function post(url, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(`${url}?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, json: j, text };
  } catch (e) { return { ok: false, status: 0, text: e.message }; } finally { clearTimeout(t); }
}

// 1. Which models does Google say this key can use? (AI Studio lists them; Vertex express does not.)
let listed = [];
try {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
  const j = await r.json();
  if (r.ok) {
    listed = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
    say(`Google lists ${listed.length} models for this key.`);
  } else {
    say(`Could not list models: ${r.status} ${j.error?.message?.slice(0, 160) || ''}`);
  }
} catch (e) { say('Could not list models: ' + e.message); }

const textModels = listed.filter(m => /^gemini-[\d.]+-(flash|pro)(-lite)?$|^gemini-flash(-lite)?-latest$/.test(m));
const rank = (m) => { const i = DEFAULT_MODELS.indexOf(m); return i === -1 ? 50 : i; };
const candidates = [...new Set([...DEFAULT_MODELS, ...textModels.sort((a, b) => rank(a) - rank(b))])];

// 2. Try a tiny request on each provider + model until something answers.
const body = { contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: TraceErase AI is working' }] }], generationConfig: { temperature: 0, maxOutputTokens: 30 } };
const providers = key.startsWith('AIza') ? ['studio'] : ['studio', 'vertex'];
const working = [];
const errors = [];
for (const provider of providers) {
  for (const model of candidates) {
    const t0 = Date.now();
    const b = /^gemini-2\.5-flash/.test(model) ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } } : body;
    const r = await post(endpoints[provider](model), b);
    if (r.ok) {
      const out = (r.json?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      working.push({ provider, model, ms: Date.now() - t0 });
      say(`✔ ${provider === 'studio' ? 'AI Studio' : 'Vertex AI'} · ${model} · ${Date.now() - t0} ms · "${out.slice(0, 40)}"`);
      if (working.filter(w => w.provider === provider).length >= 3) break;
    } else {
      const msg = r.json?.error?.message || r.text.slice(0, 200);
      errors.push({ provider, model, status: r.status, msg });
      // A switched-off API or a blocked key fails the same way for every model: stop trying this provider
      if (r.status === 401 || /has not been used in project|is disabled|are blocked|API key not valid/i.test(msg)) {
        say(`✘ ${provider === 'studio' ? 'AI Studio' : 'Vertex AI'}: ${r.status} ${msg.slice(0, 200)}`);
        break;
      }
    }
  }
  if (working.length) break;
}

console.log('');
if (working.length) {
  const fastest = [...working].sort((a, b) => a.ms - b.ms)[0];
  const main = working[0];
  const fast = working.find(w => /lite/.test(w.model)) || fastest;
  const fallbacks = [...new Set([...working.map(w => w.model), ...candidates])].filter(m => m !== main.model).slice(0, 5);
  updateEnvFile(ENV_FILE, {
    GEMINI_PROVIDER: main.provider,
    GEMINI_MODEL: main.model,
    GEMINI_FAST_MODEL: fast.model,
    GEMINI_FALLBACK_MODELS: fallbacks.join(',')
  });
  say(`Gemini works. Saved to server/.env:`);
  say(`  GEMINI_PROVIDER=${main.provider}  (${main.provider === 'studio' ? 'Google AI Studio' : 'Vertex AI express'})`);
  say(`  GEMINI_MODEL=${main.model}`);
  say(`  GEMINI_FAST_MODEL=${fast.model}  (used for translation and quick checks)`);
  console.log('');
  process.exit(0);
}

const worst = errors.find(e => e.status === 403) || errors.find(e => e.status === 401) || errors.at(-1);
say('✘ Gemini is not working with this key yet.');
if (worst) say(`  Google said: ${worst.status} ${worst.msg.slice(0, 260)}`);
const hint = explain({ message: `${worst?.status} ${worst?.msg}` });
if (hint) { console.log(''); say('What to do: ' + hint); }
say('The app still works without AI (it uses built-in rules), and AI turns on as soon as the key works.\n');
process.exit(1);
