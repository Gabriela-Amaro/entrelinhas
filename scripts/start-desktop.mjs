import { spawn } from 'node:child_process';
import electron from 'electron';
const desktopEnv = { ...process.env };
delete desktopEnv.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env: desktopEnv });
child.on('exit', code => process.exit(code || 0));
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
