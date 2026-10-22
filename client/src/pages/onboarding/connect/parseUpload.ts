// Reads a Google Takeout .mbox file or a CSV in the browser. Only sender, subject and date are kept.
export interface MailRow { from: string; subject: string; date: string }

export function parseUpload(text: string, name: string): MailRow[] {
  const rows: MailRow[] = [];
  if (/\.mbox$/i.test(name) || /^From .+\d{4}$/m.test(text.slice(0, 2000))) {
    for (const block of text.split(/\n(?=From .*\d{4}\r?\n)/)) {
      const head = block.split(/\r?\n\r?\n/)[0];
      const from = (head.match(/^From: (.+)$/mi) || [])[1];
      if (!from) continue;
      const date = new Date((head.match(/^Date: (.+)$/mi) || [])[1] || Date.now());
      rows.push({ from: from.trim(), subject: ((head.match(/^Subject: (.+)$/mi) || [])[1] || '').trim(), date: isNaN(+date) ? new Date().toISOString() : date.toISOString() });
      if (rows.length >= 3000) break;
    }
  } else {
    for (const line of text.split(/\r?\n/).slice(0, 3001)) {
      const m = line.match(/([^,;\t]*<?[\w.+-]+@[\w.-]+\.\w+>?)[,;\t]?([^,;\t]*)?[,;\t]?(.*)?/);
      if (!m) continue;
      const d = new Date(m[3] || '');
      rows.push({ from: m[1].replace(/^"|"$/g, '').trim(), subject: (m[2] || '').trim(), date: isNaN(+d) ? new Date().toISOString() : d.toISOString() });
    }
  }
  return rows;
}
