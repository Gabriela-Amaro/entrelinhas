import { readdir, readFile, writeFile, realpath, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
const roots = ['@fontsource-variable/inter', '@fontsource-variable/lora', 'react', 'react-dom', 'lucide-react', 'markdown-it', 'markdown-it-anchor', 'markdown-it-footnote', 'markdown-it-task-lists', 'markdown-it-texmath', 'markdown-it-emoji', 'markdown-it-sub', 'markdown-it-sup', 'markdown-it-mark', 'markdown-it-ins', 'markdown-it-deflist', 'highlight.js', 'katex', 'mermaid', 'dompurify', 'idb-keyval'];
const visited = new Map();
async function findPackage(name, from) {
  let directory = from;
  while (true) {
    const candidate = join(directory, 'node_modules', name);
    try { await stat(join(candidate, 'package.json')); return await realpath(candidate); } catch {}
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Dependência não encontrada: ${name}`);
    directory = parent;
  }
}
async function visit(name, from) {
  const directory = await findPackage(name, from);
  if (visited.has(directory)) return;
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  visited.set(directory, pkg);
  for (const dependency of Object.keys(pkg.dependencies || {})) await visit(dependency, directory);
}
for (const name of roots) await visit(name, resolve('.'));
let output = 'Entrelinhas — Third-party notices\n\nThe application includes the packages and license notices below.\nElectron and Chromium notices are also distributed alongside the executable.\nFonts retain their original OFL notices. DOMPurify is distributed under its Apache-2.0 option.\n\n';
for (const [directory, pkg] of [...visited].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
  output += `\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${JSON.stringify(pkg.license || pkg.licenses || 'See package notices')}\n${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || ''}\n\n`;
  const notices = (await readdir(directory)).filter(file => /^(licen[cs]e|copying|copyright|notice|ofl)([.\-_]|$)/i.test(file));
  for (const name of notices) {
    if (!(await stat(join(directory, name))).isFile()) continue;
    output += `--- ${name} ---\n${await readFile(join(directory, name), 'utf8')}\n`;
  }
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', output);
console.log(`Notices for ${visited.size} bundled packages included.`);
