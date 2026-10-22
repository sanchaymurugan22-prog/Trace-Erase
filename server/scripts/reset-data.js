// Deletes all local TraceErase data (users, requests, receipts…). Run: npm run reset
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const targets = [path.join(here, '..', 'data', 'db.json')];
for (const t of targets) if (fs.existsSync(t)) { fs.rmSync(t); console.log('  removed', path.relative(process.cwd(), t)); }
console.log('  Done. Restart the app to start fresh.');
