import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { VM_PREFIX, type VesselPlugins } from '@vessel-js/app/node';
import { globbySync } from 'globby';
import * as path from 'pathe';

import { renderMarkdoc, svelteMarkdocTags, transformTreeNode } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/svelte/app` as const;

export function sveltePlugin(): VesselPlugins {
  let appDir: string;

  const __dirname = fileURLToPath(new URL('.', import.meta.url));

  function resolveAppId() {
    const file = globbySync([`app.svelte`, `+app.svelte`], {
      cwd: appDir,
    })[0];
    const filePath = file && path.resolve(appDir, file);
    return filePath && fs.existsSync(filePath)
      ? { id: filePath }
      : { id: path.resolve(__dirname, '../client/+app.svelte') };
  }

  return [
    {
      name: '@vessel/svelte',
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            include: ['svelte'],
          },
          resolve: {
            alias: {
              [VIRTUAL_APP_ID]: `/${VIRTUAL_APP_ID}`,
            },
          },
        };
      },
      vessel: {
        enforce: 'pre',
        config(config) {
          appDir = config.dirs.app;
          return {
            entry: {
              client: path.resolve(__dirname, '../client/entry-client.js'),
              server: path.resolve(__dirname, '../client/entry-server.js'),
            },
            client: {
              app: resolveAppId().id,
            },
            markdown: {
              markdoc: { tags: svelteMarkdocTags },
              render: renderMarkdoc,
              transformTreeNode: [transformTreeNode],
            },
          };
        },
      },
      resolveId(id) {
        if (id === `/${VIRTUAL_APP_ID}`) {
          return resolveAppId();
        }

        return null;
      },
    },
  ];
}
