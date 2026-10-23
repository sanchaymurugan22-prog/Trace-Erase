// TraceErase's branded email layout (sign-up confirmation, password reset, alerts).
// Built with tables and inline styles so it looks right in Gmail, Outlook and phone mail apps.
import { config } from '../config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const site = () => config.appUrl.replace(/\/$/, '');

const C = { navy: '#0A1630', teal: '#2DD4BF', tealDark: '#0F766E', brand: '#2348D8', ink: '#0B1220', ink2: '#334155', mute: '#64748B', line: '#E2E8F0', bg: '#F1F4F9' };
const FONT = "'Manrope','Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * @param {{ preheader?: string, title: string, intro?: string, button?: { label: string, url: string },
 *           points?: string[], note?: string, after?: string }} o
 */
export function brandedEmail(o) {
  const logo = `${site()}/email-logo.png`;
  const points = (o.points || []).map(p => `
    <tr><td style="padding:6px 0;font:15px/22px ${FONT};color:${C.ink2}">
      <span style="display:inline-block;width:20px;height:20px;border-radius:6px;background:#E6FBF7;color:${C.tealDark};font-weight:800;text-align:center;line-height:20px;margin-right:10px">&#10003;</span>${esc(p)}
    </td></tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader || o.intro || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <!-- Header -->
    <tr><td style="background:${C.navy};border-radius:20px 20px 0 0;padding:28px 32px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px"><img src="${logo}" width="44" height="44" alt="" style="display:block;border:0;border-radius:11px"></td>
        <td>
          <div style="font:800 22px/26px ${FONT};color:#ffffff;letter-spacing:-0.3px">Trace<span style="color:${C.teal}">Erase</span></div>
          <div style="font:600 12px/18px ${FONT};color:#9FB0CC;letter-spacing:0.6px;text-transform:uppercase">Find it. Delete it. Prove it.</div>
        </td>
      </tr></table>
    </td></tr>
    <!-- Body -->
    <tr><td style="background:#ffffff;padding:36px 32px 28px">
      <h1 style="margin:0 0 14px;font:800 26px/32px ${FONT};color:${C.ink};letter-spacing:-0.4px">${esc(o.title)}</h1>
      ${o.intro ? `<p style="margin:0 0 24px;font:16px/25px ${FONT};color:${C.ink2}">${esc(o.intro)}</p>` : ''}
      ${o.button ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr>
        <td style="border-radius:12px;background:${C.brand}">
          <a href="${esc(o.button.url)}" target="_blank" style="display:inline-block;padding:15px 28px;font:700 16px/20px ${FONT};color:#ffffff;text-decoration:none;border-radius:12px">${esc(o.button.label)} &rarr;</a>
        </td>
      </tr></table>` : ''}
      ${points ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px">${points}</table>` : ''}
      ${o.after ? `<p style="margin:0 0 18px;font:15px/23px ${FONT};color:${C.ink2}">${esc(o.after)}</p>` : ''}
      ${o.button ? `<p style="margin:0;padding:16px;border-radius:12px;background:${C.bg};font:13px/20px ${FONT};color:${C.mute}">
        Button not working? Copy this link into your browser:<br>
        <a href="${esc(o.button.url)}" style="color:${C.brand};word-break:break-all">${esc(o.button.url)}</a></p>` : ''}
      ${o.note ? `<p style="margin:18px 0 0;font:13px/20px ${FONT};color:${C.mute}">${esc(o.note)}</p>` : ''}
    </td></tr>
    <!-- Footer -->
    <tr><td style="background:#ffffff;border-top:1px solid ${C.line};border-radius:0 0 20px 20px;padding:20px 32px 26px">
      <p style="margin:0 0 6px;font:600 13px/20px ${FONT};color:${C.ink2}">&#128274; We never sell or share your data, and AI only sees it with your name and contact details hidden.</p>
      <p style="margin:0;font:12px/18px ${FONT};color:${C.mute}">
        TraceErase helps you use your rights under India's DPDP Act 2023 &middot;
        <a href="${site()}" style="color:${C.mute}">${esc(site().replace(/^https?:\/\//, ''))}</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** The plain-text version shown by mail apps that don't display HTML. */
export function plainText(o) {
  return [o.title, '', o.intro, '', o.button ? `${o.button.label}: ${o.button.url}` : '', ...(o.points || []).map(p => `- ${p}`), '', o.after || '', o.note || '', '', 'TraceErase · Find it. Delete it. Prove it.', site()].filter(x => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
}
