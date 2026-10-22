// Removes files from the first version of TraceErase (JavaScript + plain CSS) that the
// TypeScript + Tailwind version replaced. Runs automatically before "npm run dev"; safe to run again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = [
  'client/vite.config.js',
  'client/src/App.jsx', 'client/src/main.jsx', 'client/src/styles.css', 'client/src/app.css',
  'client/src/components/shells.jsx', 'client/src/components/ui.jsx',
  'client/src/lib/api.js', 'client/src/lib/format.js', 'client/src/lib/router.jsx', 'client/src/lib/session.jsx',
  'client/src/lib/translator.js', 'client/src/lib/webauthn.js',
  'client/src/pages/auth.jsx', 'client/src/pages/core.jsx', 'client/src/pages/deletion.jsx', 'client/src/pages/more.jsx',
  'client/src/pages/onboarding.jsx', 'client/src/pages/proof.jsx', 'client/src/pages/public.jsx', 'client/src/pages/regulator.jsx',
  'client/src/pages/business.jsx'
];
let removed = 0;
for (const rel of OLD) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) { fs.rmSync(p); removed++; }
}
if (removed) console.log(`  Cleaned up ${removed} files from the old version.`);
