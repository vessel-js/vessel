import { type VesselPlugins, VM_PREFIX } from '@vessel-js/app/node';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'pathe';

import { renderMarkdoc, solidMarkdocTags, transformTreeNode } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/solid/app` as const;

export function solidPlugin(): VesselPlugins {
  let appDir: string;

  const require = createRequire(import.meta.url);

  function resolveAppId() {
    const exts = ['.tsx', '.jsx', '.ts', '.js'];

    let appFile: string | null = null;
    for (const ext of exts) {
      const file = path.resolve(appDir, `+app${ext}`);
      if (fs.existsSync(file)) {
        appFile = file;
        break;
      }
    }

    return appFile
      ? { id: appFile }
      : { id: require.resolve(`@vessel-js/solid/app.tsx`) };
  }

  return [
    {
      name: '@vessel/solid',
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            include: ['solid-js', 'solid-js/web'],
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
          const appId = resolveAppId().id;
          return {
            entry: {
              client: require.resolve('@vessel-js/solid/entry-client.ts'),
              server: require.resolve('@vessel-js/solid/entry-server.ts'),
            },
            client: {
              app: appId,
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
