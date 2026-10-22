// Collects every piece of interface text in src/ into src/i18n/strings.json.
// Those are the strings the language dictionaries (src/i18n/locales/*.json) translate.
// Run: npm run i18n:extract
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'locales') walk(p); }
    else if (/\.(tsx?)$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p);
  }
};
walk(root);

const isClassList = (s) => {
  const tokens = s.trim().split(/\s+/);
  return tokens.every(tk => /^[a-z0-9!\-:[\]/.%#()_,'=&>~*@]+$/.test(tk)) && tokens.some(tk => /[-:[]/.test(tk));
};
const looksLikeText = (s) => {
  if (s.length < 2 || s.length > 400) return false;
  if (/^_|^Backspace$|GOCSPX|AIza|^[a-z0-9.-]+\.(com|in|mail|demo)$/.test(s)) return false;
  if (!/\p{L}{2,}/u.test(s)) return false;
  if (/^(\/|@|\.|#|https?:|mailto:|data:|[a-z]+\/[a-z])/.test(s)) return false;  // paths, urls, mime
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return false;                               // identifiers: 'primary', 'autoOtp'
  if (/^[a-z0-9-]+$/.test(s)) return false;                                     // keys: 'no-response'
  if (/^[A-Z_0-9]+$/.test(s)) return false;                                     // CONSTANTS
  if (isClassList(s)) return false;
  if (/[<>{}]/.test(s) && !/\{\w+\}/.test(s)) return false;
  if (/^(en|hi|ta|te|kn|ml|bn|mr|gu|es|fr|ar)(-[A-Z]{2})?$/.test(s)) return false;
  return true;
};

const ts = (await import('typescript')).default;
const SKIP_ATTRS = new Set(['className', 'href', 'to', 'id', 'htmlFor', 'role', 'type', 'name', 'autoComplete', 'inputMode', 'accept', 'rel', 'target', 'lang', 'dir', 'key', 'variant', 'size', 'tone', 'icon', 'status', 'translate', 'viewBox', 'fill', 'stroke', 'd', 'method']);
const out = new Set();
for (const f of files) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const attr = parent && ts.isJsxAttribute(parent) ? parent.name.getText(sf) : null;
      const prop = parent && ts.isPropertyAssignment(parent) && parent.initializer === node ? parent.name.getText(sf) : null;
      const isKey = parent && ts.isPropertyAssignment(parent) && parent.name === node;
      const inType = parent && (ts.isLiteralTypeNode(parent));
      const callee = parent && ts.isCallExpression(parent) ? parent.expression.getText(sf) : '';
      const skip = (attr && SKIP_ATTRS.has(attr)) || (prop && /^(className|to|href|key|icon|tone|value|status|kind|type|action|channel|source|lang|code|color|variant|size)$/.test(prop)) || isKey || inType ||
        /^(cn|buttonClass|get|post|patch|del|api|navigate|import|require|querySelector|addEventListener|removeEventListener|getItem|setItem|removeItem|includes|startsWith|endsWith|split|join|replace|match|test|setAttribute|dispatchEvent|createElement|localStorage\.\w+|document\.\w+|window\.\w+)$/.test(callee.split('.').pop() || '');
      if (!skip && looksLikeText(node.text)) out.add(node.text);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const list = [...out].sort((a, b) => a.localeCompare(b));
fs.writeFileSync(path.join(root, 'i18n', 'strings.json'), JSON.stringify(list, null, 1) + '\n');
console.log(`  ${list.length} interface strings → src/i18n/strings.json`);
