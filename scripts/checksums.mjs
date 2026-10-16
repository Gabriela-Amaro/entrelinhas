import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const directory = resolve(process.argv[2] || 'release');
const files = (await readdir(directory, { withFileTypes: true })).filter(file => file.isFile() && /\.(AppImage|deb|rpm|exe|dmg|tar\.gz)$/.test(file.name)).map(file => file.name).sort();
if (!files.length) throw new Error('Nenhum instalador encontrado.');
const lines = [];
for (const name of files) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(join(directory, name))) hash.update(chunk);
  lines.push(`${hash.digest('hex')}  ${name}`);
}
await writeFile(join(directory, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(`SHA256SUMS.txt: ${files.length} instaladores.`);
