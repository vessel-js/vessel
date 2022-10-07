import { watch } from 'chokidar';
import { defineConfig } from 'tsup';

import { base, copyFiles } from '../app/tsup.config';

if (process.env.DEV) {
  await copyFiles('**/*');

  watch('src/client/**/*').on('all', async () => {
    await copyFiles('**/*');
  });
} else {
  await copyFiles('**/*');
}

export default defineConfig([
  {
    ...base(),
    entry: { index: 'src/node/index.ts' },
    target: 'node16',
    platform: 'node',
    outDir: 'dist/node',
  },
]);
