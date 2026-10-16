import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const temporary: string[] = [];
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }); });
describe.runIf(process.platform === 'linux')('Instalação Linux no menu', () => {
  it('instala em caminhos com espaços e aspas, preserva argumentos e remove só o app', () => {
    const root = mkdtempSync(join(tmpdir(), 'entrelinhas-installer-')); temporary.push(root);
    const source = join(root, 'app'); mkdirSync(source);
    const executable = join(source, 'entrelinhas');
    writeFileSync(executable, '#!/bin/sh\nprintf "%s\\n" "$@" > "$ENTRELINHAS_TEST_ARGUMENTS"\n'); chmodSync(executable, 0o755);
    const icon = join(root, 'icon.png'); writeFileSync(icon, 'test icon');
    const prefix = join(root, "Menu com espaços ' e $ e 100%");
    const argsFile = join(root, 'arguments.txt');
    const env = { ...process.env, ENTRELINHAS_SOURCE_DIR: source, ENTRELINHAS_ICON_FILE: icon, ENTRELINHAS_VERSION: '1.2.0', ENTRELINHAS_TEST_ARGUMENTS: argsFile };
    const install = () => spawnSync('sh', [resolve('packaging/linux/install.sh'), '--prefix', prefix], { env, encoding: 'utf8' });
    let result = install(); expect(result.stderr, result.stdout).toBe(''); expect(result.status, result.stderr).toBe(0);
    const entry = join(prefix, 'share/applications/com.entrelinhas.reader.desktop');
    expect(readFileSync(entry, 'utf8')).toContain('Name=Entrelinhas');
    expect(readFileSync(entry, 'utf8')).toContain('100%%');
    const launcher = join(prefix, 'bin/entrelinhas');
    const launch = spawnSync(launcher, ['um arquivo.md', 'outro.md'], { env, encoding: 'utf8' });
    expect(launch.status, launch.stderr).toBe(0);
    expect(readFileSync(argsFile, 'utf8').split('\n').filter(Boolean)).toEqual(['--class=com.entrelinhas.reader', 'um arquivo.md', 'outro.md']);
    result = install(); expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(join(prefix, 'share/entrelinhas/versions'))).toHaveLength(2);
    const session = join(prefix, 'config/Entrelinhas'); mkdirSync(session, { recursive: true }); writeFileSync(join(session, 'workspace.json'), '{}');
    const uninstall = spawnSync('sh', [resolve('packaging/linux/uninstall.sh'), '--prefix', prefix], { env, encoding: 'utf8' });
    expect(uninstall.status, uninstall.stderr).toBe(0);
    expect(existsSync(launcher)).toBe(false); expect(existsSync(entry)).toBe(false);
    expect(existsSync(join(prefix, 'share/entrelinhas'))).toBe(false);
    expect(existsSync(join(session, 'workspace.json'))).toBe(true);
  });
});
