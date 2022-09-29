import { defineConfig } from 'tsup';

import { base } from '../app/tsup.config';

export default defineConfig([
  {
    ...base({ external: [/\.vue/] }),
    entry: {
      index: 'src/client/index.ts',
      head: 'src/client/head/index.ts',
      '+app': 'src/client/+app.ts',
      'entry-client': 'src/client/entry-client.ts',
      'entry-server': 'src/client/entry-server.ts',
    },
    target: 'esnext',
    platform: 'browser',
    outDir: 'dist/client',
  },
  {
    ...base(),
    entry: { index: 'src/node/index.ts' },
    target: 'node16',
    platform: 'node',
    outDir: 'dist/node',
  },
]);
