// Printable documents (certificate, complaint, evidence pack). Open in the browser and "Save as PDF".
import { db } from '../db.js';
import { config } from '../config.js';
import { notFound } from '../http.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const date = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const short = (h) => h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '';

async function qrSvg(text) {
  try {
    const QR = (await import('qrcode')).default;
    return await QR.toString(text, { type: 'svg', margin: 0, width: 120, color: { dark: '#0A1630', light: '#FFFFFF' } });
  } catch {
    return `<div style="width:120px;height:120px;border:1px dashed #9aa6bb;display:flex;align-items:center;justify-content:center;font:12px sans-serif;color:#56627A;text-align:center">Install "qrcode"<br>for a QR code</div>`;
  }
}

const LOGO = `<svg width="34" height="34" viewBox="0 0 64 64"><path d="M32 8L13 15v16c0 11.5 8 19.5 19 24.5" fill="none" stroke="#0A1630" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 8l19 7v9" fill="none" stroke="#0A1630" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="48.4" y="28.9" width="5.2" height="5.2" rx="1.2" fill="#0B8F80"/><rect x="46.8" y="38.2" width="4.4" height="4.4" rx="1" fill="#0B8F80" opacity=".8"/><rect x="41.6" y="46.2" width="3.6" height="3.6" rx=".9" fill="#0B8F80" opacity=".6"/><path d="M23 31.5l6.5 6.5 12-12" fill="none" stroke="#0B7A6E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;background:#EEF2F9;font:15px/1.55 Inter,system-ui,-apple-system,sans-serif;color:#0A1630}
.bar{max-width:880px;margin:20px auto 0;display:flex;justify-content:flex-end;gap:8px}
.bar button{height:40px;padding:0 16px;border-radius:10px;border:1px solid #C9D2E1;background:#fff;font:600 14px Inter,sans-serif;cursor:pointer}
.bar button.p{background:#2350D8;color:#fff;border-color:#2350D8}
.paper{max-width:880px;margin:16px auto 40px;background:#fff;border:1px solid #C9D2E1;border-radius:8px;padding:14px}
.in{border:1.5px solid #0A1630;border-radius:4px;padding:44px 52px}
h1{font:800 40px/1.15 Manrope,Inter,sans-serif;margin:6px 0 8px;letter-spacing:-.02em}
h2{font:700 18px Manrope,Inter,sans-serif;margin:24px 0 8px}
.mute{color:#56627A}.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12.5px}
table{width:100%;border-collapse:collapse;margin-top:12px}th{text-align:left;font-size:12px;color:#56627A;padding:8px;border-bottom:1px solid #E2E7F0}td{padding:10px 8px;border-bottom:1px solid #E2E7F0;vertical-align:top}
.chip{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:600;font-size:12.5px;background:#ECEFF5}
.verified{background:#E2F4E9;color:#127A3E}.partial{background:#FCF0D6;color:#8A5A00}.claimed{background:#E5EDFF;color:#1D4ED8}.overdue,.refused{background:#FCE4DE;color:#B3361B}.no-response{background:#FDEAD9;color:#A3470A}
.top{display:flex;justify-content:space-between;align-items:center}
.foot{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;border-top:1px solid #E2E7F0;margin-top:28px;padding-top:24px}
@media print{body{background:#fff}.bar{display:none}.paper{border:0;margin:0;padding:0}}
</style></head><body><div class="bar"><button onclick="history.back()">Back</button><button class="p" onclick="print()">Save as PDF</button></div><div class="paper"><div class="in">${body}</div></div></body></html>`;

export async function certificateHtml(user, id) {
  const c = db.get('certificates', id);
  if (!c || c.userId !== user.id) throw notFound();
  const req = db.get('requests', c.requestId);
  const receipt = db.get('receipts', c.receiptId);
  const verifyUrl = `${config.appUrl}/verify/${c.receiptId}`;
  const rows = c.rows.map(r => `<tr><td><b>${esc(r.company)}</b></td><td><span class="chip ${esc(r.status)}">${esc(r.status)}</span></td><td>${esc(r.kept)}</td><td class="mono">${esc(short(r.hash))}</td></tr>`).join('');
  return page(`Certificate ${c.number}`, `
<div class="top">${LOGO}<div style="text-align:right"><div class="mono"><b>No. ${esc(c.number)}</b></div><div class="mute" style="font-size:13px">Issued ${date(c.issuedAt)}</div></div></div>
<div style="text-align:center;margin:28px 0 8px"><div style="font:700 12px Inter;letter-spacing:.1em;color:#0B7A6E">CERTIFICATE OF</div><h1>Data Deletion</h1>
<p class="mute" style="max-width:560px;margin:0 auto">This certifies the outcome of deletion request ${esc(req?.number)}, signed by ${esc(user.name)} on ${date(req?.signedAt)}, under the Digital Personal Data Protection Act, 2023.</p></div>
<table><thead><tr><th>Company</th><th>Result</th><th>Kept, and why</th><th>Proof</th></tr></thead><tbody>${rows}</tbody></table>
<div class="foot"><div style="display:flex;gap:16px;align-items:center">${await qrSvg(verifyUrl)}<div><b>Scan or visit to verify</b><div class="mono mute">${esc(verifyUrl)}</div><div class="mute" style="font-size:13px">Checks every receipt against the ledger. Any change breaks the check.</div></div></div>
<div style="text-align:right" class="mute"><div style="font-size:12px">Fingerprint</div><div class="mono">${esc(short(receipt?.hash))}</div></div></div>`);
}

export function complaintHtml(user, id) {
  const c = db.get('complaints', id);
  if (!c || c.userId !== user.id) throw notFound();
  const pack = db.get('evidence', c.packId);
  return page(`Complaint ${c.reference || 'draft'}`, `
<div class="top">${LOGO}<div class="mono"><b>${esc(c.reference || 'DRAFT')}</b></div></div>
<h1 style="font-size:30px">Complaint to the ${esc(c.to)}</h1>
<p class="mute">Under the Digital Personal Data Protection Act, 2023 · ${c.filedAt ? 'Filed ' + date(c.filedAt) : 'Draft'}</p>
<h2>Complainant</h2><p>${esc(user.name)} · ${esc(user.email)} · ${esc(user.phone)}</p>
<h2>Respondents</h2><ul>${c.parties.map(p => `<li><b>${esc(p.name)}</b>: ${esc(p.issue)}</li>`).join('')}</ul>
<h2>What happened</h2><p style="white-space:pre-wrap">${esc(c.summary)}</p>
<h2>I ask the Board to</h2><ol>${(c.asks || []).map(a => `<li>${esc(a)}</li>`).join('')}</ol>
<h2>Evidence ${pack ? esc(pack.number) : ''}</h2>
<table><thead><tr><th>#</th><th>Record</th><th>Proves</th><th>Fingerprint</th></tr></thead><tbody>${(pack?.items || []).map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.label)}<div class="mute" style="font-size:12px">${date(i.at)}</div></td><td>${esc(i.proves)}</td><td class="mono">${esc(short(i.hash))}</td></tr>`).join('')}</tbody></table>
<p class="mute" style="font-size:12.5px;margin-top:20px">Each fingerprint can be checked at ${esc(config.appUrl)}/verify/&lt;record&gt;. In this prototype, filing is recorded in TraceErase; submit this document on the Board's portal to file it officially.</p>`);
}

export function evidenceHtml(user, id) {
  const p = db.get('evidence', id);
  if (!p || p.userId !== user.id) throw notFound();
  return page(`Evidence pack ${p.number}`, `
<div class="top">${LOGO}<div class="mono"><b>${esc(p.number)}</b></div></div>
<h1 style="font-size:30px">Evidence pack: ${esc(p.title)}</h1><p class="mute">Built ${date(p.builtAt)} for ${esc(user.name)}</p>
<table><thead><tr><th>#</th><th>Record</th><th>Proves</th><th>Source</th><th>Fingerprint</th></tr></thead><tbody>${p.items.map((i, n) => `<tr><td>${n + 1}</td><td><b>${esc(i.label)}</b><div class="mute" style="font-size:12px">${date(i.at)}</div></td><td>${esc(i.proves)}</td><td>${esc(i.source)}</td><td class="mono">${esc(short(i.hash))}</td></tr>`).join('')}</tbody></table>`);
}
