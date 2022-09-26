import globby from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Options } from 'tsup';

export function base(extend?: { external?: (string | RegExp)[] }): Options {
  return {
    format: 'esm',
    external: ['rollup', ':virtual', ...(extend?.external ?? [])],
    treeshake: true,
    splitting: true,
    dts: true,
    outDir: 'dist',
    esbuildOptions(opts) {
      if (opts.platform === 'browser') opts.mangleProps = /^_/;
      opts.chunkNames = 'chunks/[name]-[hash].js';
    },
  };
}

export default defineConfig([
  {
    ...base(),
    entry: { client: 'src/client/index.ts' },
    target: 'esnext',
    platform: 'browser',
  },
  {
    ...base(),
    entry: {
      node: 'src/node/index.ts',
      'node/http': 'src/node/http/index.ts',
      server: 'src/server/index.ts',
      'server/polyfills': 'src/server/polyfills.ts',
    },
    target: 'node16',
    platform: 'node',
  },
]);

export async function copyFiles(
  glob: string,
  from = 'src/client',
  to = 'dist/client',
) {
  const fromDir = path.resolve(process.cwd(), from);
  const toDir = path.resolve(process.cwd(), to);
  const globs = `${fromDir}/${glob}`;
  const files = await globby(globs, { absolute: true });
  await Promise.all(
    files.map(async (file) => {
      const dest = path.resolve(toDir, path.relative(fromDir, file));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(file, dest);
    }),
  );
}
