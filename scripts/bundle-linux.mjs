import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'linux') throw new Error('Execute o empacotamento Linux no Linux.');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const name = `Entrelinhas-${version}-linux-${process.arch}`;
const temporary = await mkdtemp(join(tmpdir(), 'entrelinhas-bundle-'));
try {
  const bundle = join(temporary, name);
  await cp('release/linux-unpacked', join(bundle, 'app'), { recursive: true });
  for (const file of ['install.sh', 'uninstall.sh']) await cp(join('packaging/linux', file), join(bundle, file));
  await cp('public/icon.png', join(bundle, 'icon.png'));
  await cp('LICENSE', join(bundle, 'LICENSE'));
  await writeFile(join(bundle, 'VERSION'), version + '\n');
  await writeFile(join(bundle, 'LEIA-ME.txt'), `Entrelinhas ${version}\n\nInstalar no menu (sem Node.js e sem sudo):\n  sh install.sh\n\nDesinstalar preservando a sessão:\n  sh uninstall.sh\n\nAbra um terminal na pasta extraída para executar os comandos.\nNão precisa de FUSE. Guarde o uninstall.sh se quiser remover o app depois.\n\nProjeto: https://github.com/Gabriela-Amaro/entrelinhas\n`);
  const result = spawnSync('tar', ['-czf', resolve('release', name + '.tar.gz'), '-C', temporary, name], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Não foi possível criar o pacote Linux.');
  console.log(`Criado: release/${name}.tar.gz`);
} finally { await rm(temporary, { recursive: true, force: true }); }
