import { type VesselPlugins, VM_PREFIX } from '@vessel-js/app/node';
import { globbySync } from 'globby';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { renderMarkdoc, solidMarkdocTags, transformTreeNode } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/solid/app` as const;

export function solidPlugin(): VesselPlugins {
  let appDir: string;

  const require = createRequire(import.meta.url);

  function resolveAppId() {
    const exts = ['tsx', 'jsx', 'ts', 'js'].join(', ');
    const file = globbySync([`app.{${exts}}`, `+app.{${exts}}`], {
      cwd: appDir,
    })[0];
    return file && fs.existsSync(file)
      ? { id: file }
      : { id: require.resolve(`@vessel-js/solid/+app.tsx`) };
  }

  return [
    {
      name: '@vessel/solid',
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            extensions: ['jsx', 'tsx'],
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
