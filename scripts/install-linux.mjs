import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'linux') throw new Error('Este instalador é para Linux.');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
const source = join(project, 'release', 'linux-unpacked');
try { await stat(join(source, 'entrelinhas')); }
catch { throw new Error('Gere o aplicativo com npm run pack ou npm run dist:linux antes de instalar.'); }
const result = spawnSync('sh', [join(project, 'packaging/linux/install.sh'), ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, ENTRELINHAS_SOURCE_DIR: source, ENTRELINHAS_ICON_FILE: join(project, 'public/icon.png'), ENTRELINHAS_VERSION: version },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
