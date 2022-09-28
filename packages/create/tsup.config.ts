import { defineConfig } from 'tsup';

export default defineConfig([
  {
    format: 'esm',
    entry: { cli: 'src/cli.ts' },
    target: 'node16',
    platform: 'node',
    bundle: true,
    outDir: 'dist',
  },
]);
