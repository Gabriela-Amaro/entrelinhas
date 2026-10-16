import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electron from 'electron';
const testData = await mkdtemp(join(tmpdir(), 'entrelinhas-test-'));
try {
  for (const phase of ['open', 'restore']) {
    const env = { ...process.env, ENTRELINHAS_SMOKE: '1', ENTRELINHAS_TEST_DATA: testData, ENTRELINHAS_TEST_PHASE: phase };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.VITE_DEV_SERVER_URL;
    const code = await new Promise((resolve, reject) => {
      const child = spawn(electron, ['tests/desktop-smoke.cjs'], { env, stdio: 'inherit' });
      child.on('error', reject); child.on('exit', resolve);
    });
    if (code !== 0) throw new Error(`O teste desktop falhou na fase ${phase}: ${code}`);
  }
} finally { await rm(testData, { recursive: true, force: true }); }
