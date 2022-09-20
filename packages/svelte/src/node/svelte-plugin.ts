import {
  normalizePath,
  type VesselPlugins,
  VM_PREFIX,
} from '@vessel-js/app/node';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { renderMarkdoc, svelteMarkdocTags, transformTreeNode } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/svelte/app` as const;

export function sveltePlugin(): VesselPlugins {
  let appDir: string;

  function resolveAppId() {
    const appFile = normalizePath(path.resolve(appDir, '+app.svelte'));
    return fs.existsSync(appFile)
      ? { id: appFile }
      : { id: '@vessel-js/svelte/app.svelte' };
  }

  const require = createRequire(import.meta.url);

  return [
    {
      name: '@vessel/svelte',
      enforce: 'pre',
      config() {
        return {
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
          const appId = resolveAppId().id;
          return {
            entry: {
              client: require.resolve('@vessel-js/svelte/entry-client.js'),
              server: require.resolve('@vessel-js/svelte/entry-server.js'),
            },
            client: {
              app: appId,
              configFiles: [config.isBuild ? appId : VIRTUAL_APP_ID],
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
