// A small email (MIME) reader: headers, encoded subjects, multipart bodies, base64 and
// quoted-printable, and character sets. Enough to understand an incoming email; no dependencies.

const decodeBytes = (buf, charset = 'utf-8') => {
  try { return new TextDecoder(String(charset).toLowerCase().replace(/^"|"$/g, '') || 'utf-8').decode(buf); }
  catch { return new TextDecoder('utf-8').decode(buf); }
};

function qpBytes(s, header = false) {
  if (header) s = s.replace(/_/g, ' ');
  s = s.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) { out.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else { const b = Buffer.from(s[i], 'latin1'); out.push(...b); }
  }
  return Buffer.from(out);
}

/** =?utf-8?B?...?= and =?utf-8?Q?...?= words in headers. */
export function decodeWords(s = '') {
  return String(s)
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, '$1')
    .replace(/=\?([^?*]+)(?:\*[^?]*)?\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, txt) => {
      const buf = enc.toUpperCase() === 'B' ? Buffer.from(txt, 'base64') : qpBytes(txt, true);
      return decodeBytes(buf, cs);
    });
}

function splitHead(raw) {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m) return { head: raw, body: '' };
  return { head: raw.slice(0, m.index), body: raw.slice(m.index + m[0].length) };
}

/** Headers as { lowercase-name: [values...] } (folded lines joined). */
export function parseHeaders(head) {
  const out = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    (out[k] ||= []).push(line.slice(i + 1).trim());
  }
  return out;
}

const param = (value = '', name) => {
  const m = String(value).match(new RegExp(`;\\s*${name}\\*?=\\s*(?:"([^"]*)"|([^;\\s]*))`, 'i'));
  return m ? (m[1] ?? m[2]) : '';
};

function bodyText(body, headers) {
  const cte = (headers['content-transfer-encoding']?.[0] || '7bit').toLowerCase();
  const charset = param(headers['content-type']?.[0], 'charset') || 'utf-8';
  // The raw message is read as latin1 so every byte survives until we know the real encoding
  let buf;
  if (cte === 'base64') buf = Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  else if (cte === 'quoted-printable') buf = qpBytes(body);
  else buf = Buffer.from(body, 'latin1');
  return decodeBytes(buf, charset);
}

export const htmlToText = (html) => String(html)
  .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*/g, '\n\n').trim();

function walk(raw, acc, depth = 0) {
  const { head, body } = splitHead(raw);
  const headers = parseHeaders(head);
  const ct = (headers['content-type']?.[0] || 'text/plain').toLowerCase();
  const disp = (headers['content-disposition']?.[0] || '').toLowerCase();
  if (ct.startsWith('multipart/') && depth < 8) {
    const boundary = param(headers['content-type'][0], 'boundary');
    if (!boundary) return;
    const parts = body.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*\\r?\\n?`));
    for (const p of parts.slice(1)) if (p.trim()) walk(p, acc, depth + 1);
    return;
  }
  if (disp.startsWith('attachment')) { acc.attachments.push(decodeWords(param(disp, 'filename') || param(headers['content-type'][0], 'name') || 'file')); return; }
  if (ct.startsWith('text/plain') && !acc.text) acc.text = bodyText(body, headers);
  else if (ct.startsWith('text/html') && !acc.html) acc.html = bodyText(body, headers);
  else if (ct.startsWith('message/rfc822') && depth < 8) walk(body, acc, depth + 1);
}

/**
 * @param {string|Buffer} input the whole email as received
 * @returns {{from:string, to:string, subject:string, date:string, messageId:string, text:string, html:string, dkim:'pass'|'fail'|'none'|undefined, attachments:string[], headers:object}}
 */
export function parseEmail(input) {
  const raw = Buffer.isBuffer(input) ? input.toString('latin1') : String(input);
  const { head } = splitHead(raw);
  const headers = parseHeaders(head);
  const h = (k) => decodeWords(Buffer.from(headers[k]?.[0] || '', 'latin1').toString('utf8'));
  const acc = { text: '', html: '', attachments: [] };
  walk(raw, acc);
  const auth = [...(headers['authentication-results'] || []), ...(headers['arc-authentication-results'] || [])].join(' ; ').toLowerCase();
  const dk = auth.match(/\bdkim=(pass|fail|none|neutral|policy|temperror|permerror)/)?.[1];
  const dmarc = auth.match(/\bdmarc=(pass|fail|none)/)?.[1];
  const dkim = dk === 'pass' || dmarc === 'pass' ? 'pass' : (dk === 'fail' || dmarc === 'fail') ? 'fail' : dk ? 'none' : undefined;
  const text = (acc.text || htmlToText(acc.html)).replace(/\r\n/g, '\n').trim();
  return { from: h('from'), to: h('to'), subject: h('subject'), date: h('date'), messageId: h('message-id'), text, html: acc.html, dkim, attachments: acc.attachments, headers };
}
