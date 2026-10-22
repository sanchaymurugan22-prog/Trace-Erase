// TraceErase browser extension popup.
const API = 'http://localhost:4000/api';
const $ = (id) => document.getElementById(id);
let token = null, tab = null, site = null;

async function call(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), { status: r.status });
  return j;
}

function show(id) { for (const s of ['connect', 'ready']) $(s).classList.toggle('hidden', s !== id); }

async function fill(kind, value) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [kind, value],
    func: (kind, value) => {
      const sel = kind === 'email'
        ? 'input[type=email], input[name*=mail i], input[id*=mail i], input[autocomplete=email]'
        : 'input[type=tel], input[name*=phone i], input[id*=phone i], input[name*=mobile i], input[autocomplete=tel]';
      const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null);
      for (const el of els) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return els.length;
    }
  }).then(([r]) => { $('err').textContent = r.result ? '' : `No ${kind} field found on this page.`; });
}

async function load() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  ({ te_token: token } = await chrome.storage.local.get('te_token'));
  if (!token) { show('connect'); $('site').textContent = new URL(url || 'http://x').hostname || 'This site'; $('sub').textContent = 'Not connected'; return; }
  try {
    site = await call('/ext/site?url=' + encodeURIComponent(url));
    show('ready');
    $('site').textContent = site.domain;
    $('mono').textContent = (site.company?.name || site.domain)[0].toUpperCase();
    $('sub').textContent = site.company ? (site.address ? 'You have a protected email here' : 'Known company') : 'New site';
    $('phone').textContent = site.protectedNumber || '—';
    if (site.address) { $('email').textContent = site.address.email; $('create').classList.add('hidden'); $('fillEmail').classList.remove('hidden'); }
    else { $('email').textContent = 'None yet'; $('create').classList.remove('hidden'); $('fillEmail').classList.add('hidden'); }
    if (site.summary) { $('aibox').classList.remove('hidden'); $('ai').textContent = site.summary; }
  } catch (e) {
    if (e.status === 401) { await chrome.storage.local.remove('te_token'); token = null; show('connect'); $('cerr').textContent = 'Your connection code expired. Create a new one.'; }
    else $('err').textContent = 'Could not reach TraceErase at localhost:4000. Is it running?';
  }
}

$('save').onclick = async () => {
  token = $('token').value.trim();
  if (!token) return;
  try { await call('/me'); await chrome.storage.local.set({ te_token: token }); load(); }
  catch { $('cerr').textContent = 'That code did not work.'; }
};
$('create').onclick = async () => {
  try { const r = await call('/identity/protect', { method: 'POST', body: JSON.stringify({ app: site.domain }) }); site.address = r.address; load(); }
  catch (e) { $('err').textContent = e.message; }
};
$('fillEmail').onclick = () => site?.address && fill('email', site.address.email);
$('fillPhone').onclick = () => site?.protectedNumber && fill('phone', site.protectedNumber.replace(/\s/g, ''));
$('logout').onclick = async () => { await chrome.storage.local.remove('te_token'); token = null; show('connect'); };
load();
