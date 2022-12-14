import fs from 'node:fs/promises';

import globby from 'fast-glob';
import * as path from 'pathe';
import { defineConfig, type Options } from 'tsup';

export function base(extend?: { external?: (string | RegExp)[] }): Options {
  return {
    format: 'esm',
    external: [
      'typescript',
      'rollup',
      'chokidar',
      'esbuild',
      'vite',
      ':virtual',
      'shiki',
      '@wooorm/starry-night',
      ...(extend?.external ?? []),
    ],
    treeshake: true,
    splitting: true,
    dts: true,
    outDir: 'dist',
    esbuildOptions(opts) {
      if (opts.platform === 'browser') opts.mangleProps = /^_/;
      opts.chunkNames = 'chunks/[name]-[hash]';
    },
  };
}

export default defineConfig([
  {
    ...base(),
    entry: {
      // shared
      http: 'src/shared/http/index.ts',
      routing: 'src/shared/routing/index.ts',
      // client
      client: 'src/client/index.ts',
      head: 'src/client/head/index.ts',
      // server
      server: 'src/server/index.ts',
    },
    target: 'esnext',
    platform: 'browser',
  },
  {
    ...base(),
    entry: {
      // node
      node: 'src/node/index.ts',
      'node/http': 'src/node/http/index.ts',
      'node/polyfills': 'src/node/polyfills.ts',
    },
    target: 'node16',
    platform: 'node',
  },
]);

export async function copyFiles(glob: string, from = 'src/client', to = 'dist/client') {
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
