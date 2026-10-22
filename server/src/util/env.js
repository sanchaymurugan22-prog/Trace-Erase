// Minimal .env loader and writer (no dependency).
import fs from 'node:fs';

export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, '');
    out[key] = val;
  }
  return out;
}

/** Load a .env file into process.env. Existing variables win unless override is true. */
export function loadEnv(file, { override = false } = {}) {
  if (!fs.existsSync(file)) return false;
  for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(file, 'utf8')))) {
    if (override || process.env[k] === undefined) process.env[k] = v;
  }
  return true;
}

/** Set keys in a .env file, keeping every other line (and comments) as they are. */
export function updateEnvFile(file, values) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const done = new Set();
  const next = lines.map(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in values) { done.add(m[1]); return `${m[1]}=${values[m[1]]}`; }
    return line;
  });
  for (const [k, v] of Object.entries(values)) if (!done.has(k)) next.push(`${k}=${v}`);
  fs.writeFileSync(file, next.join('\n').replace(/\n*$/, '\n'));
  for (const [k, v] of Object.entries(values)) process.env[k] = String(v);
}
