// Gemini client. Talks to Google's REST API directly (no SDK), so it works with
// Google AI Studio keys ("AIza…") and Google Cloud / Vertex AI express keys ("AQ.…").
// The key never leaves the server.
import { config, DEFAULT_MODELS } from '../config.js';
import { db } from '../db.js';

const status = {
  provider: null, model: null, fastModel: null, lastOk: null, lastError: null, hint: null,
  calls: 0, failures: 0, blockedUntil: 0, attempts: []
};
export const aiStatus = () => ({
  configured: !!config.geminiKey && !config.aiDisabled,
  provider: status.provider, model: status.model || status.fastModel, fastModel: status.fastModel, lastOk: status.lastOk, lastError: status.lastError,
  hint: status.hint, calls: status.calls, failures: status.failures,
  paused: status.blockedUntil > Date.now(), attempts: status.attempts.slice(-6)
});

/** Forget earlier failures (after the key or .env changed). */
export function resetAi() { Object.assign(status, { provider: null, model: null, fastModel: null, lastError: null, hint: null, blockedUntil: 0, attempts: [] }); }

export const endpoints = {
  vertex: (m) => `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:generateContent`,
  studio: (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`
};

function providerOrder() {
  const k = config.geminiKey;
  if (config.geminiProvider === 'vertex') return ['vertex'];
  if (config.geminiProvider === 'studio') return ['studio'];
  if (status.provider) return [status.provider, status.provider === 'vertex' ? 'studio' : 'vertex'];
  return k.startsWith('AIza') ? ['studio'] : ['studio', 'vertex'];
}
function modelOrder(fast) {
  const first = fast ? [config.geminiFastModel, config.geminiModel] : [config.geminiModel, config.geminiFastModel];
  const uniq = [...new Set([...first, ...config.geminiFallbackModels, ...DEFAULT_MODELS].filter(Boolean))];
  // Start with the model that last worked for this kind of call (main or quick)
  const known = fast ? status.fastModel : status.model;
  if (known) return [known, ...uniq.filter(m => m !== known)];
  return uniq;
}

/** Models to try for the main model: the configured one, then the newest Flash models; "lite" models only last. */
export const mainModelCandidates = () =>
  [...new Set([config.geminiModel, ...DEFAULT_MODELS].filter(Boolean))].sort((a, b) => /lite/.test(a) - /lite/.test(b));

export class AIError extends Error {
  constructor(msg, code, reason) { super(msg); this.code = code; this.reason = reason; }
}

/** Explain a Google error in plain words, with what to do. */
export function explain(err) {
  const m = String(err?.message || '');
  const project = (m.match(/project (\d+)/) || [])[1];
  if (/has not been used in project|is disabled|SERVICE_DISABLED/i.test(m)) {
    return `The Gemini API is switched off for this key's Google Cloud project${project ? ` (${project})` : ''}. Turn on "Generative Language API" at https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com${project ? `?project=${project}` : ''}, or create a new key at https://aistudio.google.com/apikey and put it in server/.env.`;
  }
  if (/are blocked|API_KEY_SERVICE_BLOCKED|restricted/i.test(m)) {
    return 'This key is restricted and cannot call Gemini. In Google Cloud Console → APIs & Services → Credentials, allow "Generative Language API" for the key, or create a new key at https://aistudio.google.com/apikey.';
  }
  if (/API key not valid|API_KEY_INVALID|invalid authentication|401/i.test(m)) return 'The key is not valid. Create a new key at https://aistudio.google.com/apikey and put it in server/.env.';
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(m)) return 'The free quota is used up for now. Wait a minute, or enable billing for the project.';
  if (/not found|404/i.test(m)) return 'This model is not available to the key. Run "npm run check:ai" to pick one that is.';
  if (/fetch failed|ENOTFOUND|timed out|ECONN/i.test(m)) return 'Could not reach Google. Check the internet connection.';
  return null;
}

async function callOnce(provider, model, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 40000);
  try {
    const res = await fetch(`${endpoints[provider](model)}?key=${encodeURIComponent(config.geminiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 300), reason;
      try { const j = JSON.parse(text).error; msg = j?.message || msg; reason = j?.details?.find(d => d.reason)?.reason || j?.status; } catch {}
      throw new AIError(`${provider}/${model}: ${res.status} ${msg}`, res.status, reason);
    }
    const json = JSON.parse(text);
    const cand = json.candidates?.[0];
    const out = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    if (!out) throw new AIError(`${provider}/${model}: empty response (${cand?.finishReason || 'no candidates'})`, 502);
    return out;
  } catch (e) {
    if (e.name === 'AbortError') throw new AIError(`${provider}/${model}: timed out`, 504);
    if (e instanceof AIError) throw e;
    throw new AIError(`${provider}/${model}: ${e.message}`, 503);
  } finally { clearTimeout(t); }
}

// Errors that mean the whole provider is unusable with this key (no point trying other models)
const providerDead = (e) => e.code === 401 || /SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED|API_KEY_INVALID|CONSUMER_INVALID/.test(e.reason || '') ||
  /has not been used in project|is disabled|are blocked|API key not valid|API key expired/i.test(e.message);

/**
 * Generate text or JSON.
 * @param {object} o
 * @param {string} o.feature   label for logs
 * @param {string} [o.system]  system instruction
 * @param {string|Array} o.prompt  user prompt, or an array of {role, text} turns
 * @param {boolean} [o.json]   ask for JSON and parse it
 * @param {boolean} [o.fast]   prefer the fast model (translation, classification)
 */
export async function generate({ feature = 'ai', system, prompt, json = false, temperature = 0.3, maxTokens = 2048, fast = false, models }) {
  if (!config.geminiKey || config.aiDisabled) throw new AIError('AI is not configured', 0);
  if (status.blockedUntil > Date.now()) throw new AIError(`AI paused: ${status.lastError}`, 0, 'PAUSED');
  const contents = Array.isArray(prompt)
    ? prompt.map(t => ({ role: t.role === 'assistant' || t.role === 'model' ? 'model' : 'user', parts: [{ text: t.text }] }))
    : [{ role: 'user', parts: [{ text: prompt }] }];
  const started = Date.now();
  status.calls++;
  let lastErr;
  const attempts = [];
  outer: for (const provider of providerOrder()) {
    for (const model of models || modelOrder(fast)) {
      const generationConfig = { temperature, maxOutputTokens: maxTokens };
      if (json) generationConfig.responseMimeType = 'application/json';
      if (/^gemini-2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      const body = { contents, generationConfig };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      try {
        let out;
        try { out = await callOnce(provider, model, body); }
        catch (e) {
          if (e.code === 429 || e.code >= 500) { await new Promise(r => setTimeout(r, 1200)); out = await callOnce(provider, model, body); }
          else if (e.code === 400 && body.generationConfig.thinkingConfig) { delete body.generationConfig.thinkingConfig; out = await callOnce(provider, model, body); }
          else throw e;
        }
        Object.assign(status, { provider, [fast ? 'fastModel' : 'model']: model, lastOk: new Date().toISOString(), lastError: null, hint: null, blockedUntil: 0 });
        db.insert('aiLog', { feature, provider, model, ok: true, ms: Date.now() - started });
        if (!json) return out.trim();
        return parseJson(out);
      } catch (e) {
        lastErr = e;
        attempts.push({ provider, model, code: e.code, error: e.message.slice(0, 240) });
        if (providerDead(e)) break; // same answer for every model on this provider
        if ([400, 404].includes(e.code) || e.code >= 500 || e.code === 429) continue;
        if (e.code === 401 || e.code === 403) break; // permission problem here: try the other Google endpoint
        break outer; // any other error: stop, but still record why below
      }
    }
  }
  status.failures++;
  // Prefer the most useful error: a permission problem over "model not found"
  const best = attempts.find(a => a.code === 403) || attempts.find(a => a.code === 401) || attempts.at(-1);
  status.lastError = best?.error || lastErr?.message || 'unknown error';
  status.hint = explain({ message: status.lastError }) || `Google said: ${status.lastError}`;
  status.attempts = attempts;
  // Key/permission problems will not fix themselves in seconds: pause AI for 3 minutes so the app stays fast
  if (attempts.length && attempts.every(a => [401, 403, 404, 400].includes(a.code))) status.blockedUntil = Date.now() + 3 * 60 * 1000;
  db.insert('aiLog', { feature, ok: false, ms: Date.now() - started, error: status.lastError.slice(0, 200) });
  throw new AIError(status.lastError, lastErr?.code || 500);
}

export function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (m) return JSON.parse(m[0]);
  throw new AIError('AI returned invalid JSON', 502);
}

/** Run an AI task; if AI is unavailable or fails, use the rule-based fallback. */
export async function withFallback(feature, aiFn, fallbackFn) {
  try {
    const result = await aiFn();
    return { ...(typeof result === 'object' && !Array.isArray(result) ? result : { value: result }), _ai: true };
  } catch (e) {
    if (e.code !== 0) console.warn(`[ai] ${feature} fell back to rules:`, e.message);
    const result = await fallbackFn(e);
    return { ...(typeof result === 'object' && !Array.isArray(result) ? result : { value: result }), _ai: false, _aiError: e.code === 0 ? 'AI not available' : e.message };
  }
}

// ---- Personal data masking: nothing that identifies the user is sent to the AI ----
export function maskFor(user) {
  const pairs = [];
  if (user?.name) {
    pairs.push([user.name, '[USER_NAME]']);
    const first = user.name.split(/\s+/)[0];
    if (first && first.length > 2) pairs.push([first, '[USER_FIRST_NAME]']);
  }
  if (user?.email) pairs.push([user.email, '[USER_EMAIL]']);
  if (user?.phone) {
    pairs.push([user.phone, '[USER_PHONE]']);
    const digits = user.phone.replace(/\D/g, '');
    if (digits.length >= 10) pairs.push([digits.slice(-10), '[USER_PHONE]']);
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    mask: (text) => pairs.reduce((t, [real, tag]) => t.replace(new RegExp(esc(real), 'gi'), tag), String(text ?? '')),
    unmask: (text) => pairs.reduce((t, [real, tag]) => t.split(tag).join(real), String(text ?? ''))
  };
}

export function unmaskDeep(obj, unmask) {
  if (typeof obj === 'string') return unmask(obj);
  if (Array.isArray(obj)) return obj.map(v => unmaskDeep(v, unmask));
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, unmaskDeep(v, unmask)]));
  return obj;
}
