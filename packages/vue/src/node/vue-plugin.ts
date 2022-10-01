import { type VesselPlugins, VM_PREFIX } from '@vessel-js/app/node';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'pathe';

import { renderMarkdoc, transformTreeNode, vueMarkdocTags } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/vue/app` as const;

export function vuePlugin(): VesselPlugins {
  let appDir: string;

  const require = createRequire(import.meta.url);

  function resolveAppId() {
    const exts = ['.vue', '.ts', '.js'];

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
      : { id: require.resolve('@vessel-js/vue/+app.js') };
  }

  return [
    {
      name: '@vessel/vue',
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            include: ['vue', 'vue/server-renderer'],
          },
          ssr: {
            noExternal: /./,
          },
          resolve: {
            alias: [
              {
                find: VIRTUAL_APP_ID,
                replacement: `/${VIRTUAL_APP_ID}`,
              },
              {
                find: '@vue/runtime-dom',
                replacement: '@vue/runtime-dom/dist/runtime-dom.cjs',
              },
              {
                find: '@vue/runtime-core',
                replacement: '@vue/runtime-core/dist/runtime-core.cjs',
              },
            ],
            dedupe: ['vue'],
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
              client: require.resolve('@vessel-js/vue/entry-client.js'),
              server: require.resolve('@vessel-js/vue/entry-server.js'),
            },
            client: {
              app: appId,
            },
            markdown: {
              markdoc: { tags: vueMarkdocTags },
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
