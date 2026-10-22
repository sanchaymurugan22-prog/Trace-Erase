// A tiny web framework on node:http: routing with params, JSON bodies, cookies,
// static files and errors. Keeps the server dependency-free.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { clockCtx } from './services/clock.js';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg);
export const unauthorized = (msg = 'Please log in') => new HttpError(401, msg);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};

function parseCookies(h = '') {
  const out = {};
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function compile(pattern) {
  const keys = [];
  const re = pattern === '*' ? /^.*$/ : new RegExp('^' + pattern.replace(/\/$/, '').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }).replace(/\*$/, '.*') + '/?$');
  return { re, keys };
}

async function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createApp() {
  const routes = [];
  const middleware = [];
  let staticDir = null;
  let corsOrigins = new Set();

  const add = (method) => (pattern, ...handlers) => routes.push({ method, ...compile(pattern), handlers });
  const app = {
    get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE'),
    use: (fn) => middleware.push(fn),
    static: (dir) => { staticDir = dir; },
    /** Let the website on another address (Firebase Hosting) call this API. */
    cors: (origins) => { corsOrigins = new Set(origins.map(o => o.replace(/\/$/, ''))); },
    routes
  };

  // Every request gets its own context (which account's clock to use, see services/clock.js)
  app.handler = (req, res) => clockCtx.run({ offsetMs: 0 }, () => handle(req, res));
  const handle = async (req, res) => {
    const url = new URL(req.url, 'http://local');
    req.path = decodeURIComponent(url.pathname);
    req.query = Object.fromEntries(url.searchParams);
    req.cookies = parseCookies(req.headers.cookie);
    req.ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    const origin = req.headers.origin;
    if (origin && (corsOrigins.has(origin) || origin.startsWith('chrome-extension://'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Staff-Token,X-Inbound-Secret');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (obj, code) => {
      if (code) res.statusCode = code;
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    };
    res.send = (body, type = 'text/html; charset=utf-8') => { if (!res.headersSent) res.setHeader('Content-Type', type); res.end(body); };
    res.redirect = (to) => { res.statusCode = 302; res.setHeader('Location', to); res.end(); };
    const cookies = [];
    res.cookie = (name, value, o = {}) => {
      let c = `${name}=${encodeURIComponent(value)}; Path=${o.path || '/'}; SameSite=${o.sameSite || 'Lax'}`;
      if (o.httpOnly !== false) c += '; HttpOnly';
      if (o.maxAge !== undefined) c += `; Max-Age=${o.maxAge}`;
      if (o.secure) c += '; Secure';
      cookies.push(c);
      res.setHeader('Set-Cookie', cookies);
    };

    try {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const raw = await readBody(req, req.path === '/api/inbound/raw' ? 30 * 1024 * 1024 : undefined);
        req.rawBody = raw;
        const ct = req.headers['content-type'] || '';
        if (raw.length && ct.includes('application/json')) {
          try { req.body = JSON.parse(raw.toString('utf8')); } catch { throw bad('Invalid JSON body'); }
        } else if (raw.length && ct.includes('application/x-www-form-urlencoded')) {
          req.body = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
        } else req.body = raw.length ? { raw: raw.toString('utf8') } : {};
      } else req.body = {};

      for (const mw of middleware) { await mw(req, res); if (res.writableEnded) return; }

      if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(req.path);
        if (!m) continue;
        req.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        for (const h of r.handlers) {
          const out = await h(req, res);
          if (res.writableEnded) return;
          if (out !== undefined) return res.json(out);
        }
        if (!res.writableEnded) res.json({ ok: true });
        return;
      }

      if (staticDir && req.method === 'GET' && !req.path.startsWith('/api/')) {
        let file = path.join(staticDir, path.normalize(req.path).replace(/^(\.\.[/\\])+/, ''));
        if (!file.startsWith(staticDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, 'index.html');
        if (fs.existsSync(file)) {
          res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
          return fs.createReadStream(file).pipe(res);
        }
      }
      throw notFound(`No route for ${req.method} ${req.path}`);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[api error]', req.method, req.path, e);
      if (!res.writableEnded) res.json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : e.message, ...(e.extra || {}) }, status);
    }
  };

  app.listen = (port, cb) => {
    const server = http.createServer(app.handler);
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') { console.error(`\n  Port ${port} is already in use. Stop the other TraceErase window (Ctrl+C) or set PORT in server/.env.\n`); process.exit(1); }
      throw e;
    });
    return server.listen(port, cb);
  };
  return app;
}
