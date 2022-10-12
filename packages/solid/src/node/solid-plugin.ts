import { type VesselPlugins, VM_PREFIX } from '@vessel-js/app/node';
import { globbySync } from 'globby';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'pathe';

import { renderMarkdoc, solidMarkdocTags, transformTreeNode } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/solid/app` as const;

export function solidPlugin(): VesselPlugins {
  let appDir: string;

  const __dirname = fileURLToPath(new URL('.', import.meta.url));

  function resolveAppId() {
    const exts = ['tsx', 'jsx', 'ts', 'js'].join(', ');
    const file = globbySync([`app.{${exts}}`, `+app.{${exts}}`], {
      cwd: appDir,
    })[0];
    const filePath = file && path.resolve(appDir, file);
    return filePath && fs.existsSync(filePath)
      ? { id: filePath }
      : { id: path.resolve(__dirname, '../client/+app.tsx') };
  }

  return [
    {
      name: '@vessel/solid',
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            include: ['solid-js', 'solid-js/web'],
            extensions: ['jsx', 'tsx'],
          },
          resolve: {
            alias: {
              [VIRTUAL_APP_ID]: `/${VIRTUAL_APP_ID}`,
            },
            dedupe: ['solid-js', 'solid-js/web'],
          },
        };
      },
      vessel: {
        enforce: 'pre',
        config(config) {
          appDir = config.dirs.app;
          return {
            entry: {
              client: path.resolve(__dirname, '../client/entry-client.tsx'),
              server: path.resolve(__dirname, '../client/entry-server.tsx'),
            },
            client: {
              app: resolveAppId().id,
            },
            markdown: {
              markdoc: { tags: solidMarkdocTags },
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
