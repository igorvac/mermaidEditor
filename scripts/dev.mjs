import { spawn } from 'node:child_process';
import { context } from 'esbuild';

const DEV_URL = 'http://localhost:5180';

const vite = spawn('npx', ['vite'], { stdio: 'inherit' });

const ctx = await context({
  entryPoints: ['electron/main.ts', 'electron/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron', 'electron-updater'],
  outdir: 'dist-electron',
  outExtension: { '.js': '.cjs' },
  target: 'node20'
});
await ctx.watch();

async function waitForVite() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(DEV_URL);
      if (res.ok) return;
    } catch {
      /* vite ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite dev server não respondeu');
}

await waitForVite();

const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL }
});

function shutdown() {
  vite.kill();
  ctx.dispose();
  process.exit(0);
}
electron.on('exit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
