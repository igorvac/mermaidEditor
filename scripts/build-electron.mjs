import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron', 'electron-updater'],
  outdir: 'dist-electron',
  outExtension: { '.js': '.cjs' },
  sourcemap: false,
  target: 'node20'
};

await build({ ...shared, entryPoints: ['electron/main.ts', 'electron/preload.ts'] });
console.log('electron bundles written to dist-electron/');
