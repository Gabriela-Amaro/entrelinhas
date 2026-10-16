import { spawn } from 'node:child_process';
import electron from 'electron';
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit' });
let desktop;
const stop = () => { vite.kill(); desktop?.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
for (let retry = 0; retry < 100; retry++) {
  try { if ((await fetch('http://127.0.0.1:5173')).ok) break; } catch {}
  if (retry === 99) { stop(); throw new Error('O servidor Vite não iniciou.'); }
  await new Promise(resolve => setTimeout(resolve, 200));
}
const desktopEnv = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' };
delete desktopEnv.ELECTRON_RUN_AS_NODE;
desktop = spawn(electron, ['.'], { stdio: 'inherit', env: desktopEnv });
desktop.on('exit', code => { vite.kill(); process.exit(code || 0); });
