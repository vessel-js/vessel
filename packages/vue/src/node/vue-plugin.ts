import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { VM_PREFIX, type VesselPlugins } from '@vessel-js/app/node';
import { globbySync } from 'globby';
import * as path from 'pathe';

import { renderMarkdoc, transformTreeNode, vueMarkdocTags } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/vue/app` as const;

export function vuePlugin(): VesselPlugins {
  let appDir: string;

  const __dirname = fileURLToPath(new URL('.', import.meta.url));

  function resolveAppId() {
    const exts = ['vue', 'ts', 'js'].join(', ');
    const file = globbySync([`app.{${exts}}`, `+app.{${exts}}`], {
      cwd: appDir,
    })[0];
    const filePath = file && path.resolve(appDir, file);
    return filePath && fs.existsSync(filePath)
      ? { id: filePath }
      : { id: path.resolve(__dirname, '../client/+app.js') };
  }

  return [
    {
      name: '@vessel/vue',
      enforce: 'pre',
      config(_, env) {
        const alias: { find: string; replacement: string }[] = [
          {
            find: VIRTUAL_APP_ID,
            replacement: `/${VIRTUAL_APP_ID}`,
          },
        ];

        if (env.command === 'build') {
          alias.push(
            {
              find: '@vue/runtime-dom',
              replacement: '@vue/runtime-dom/dist/runtime-dom.cjs.js',
            },
            {
              find: '@vue/runtime-core',
              replacement: '@vue/runtime-core/dist/runtime-core.cjs.js',
            },
          );
        }

        return {
          optimizeDeps: {
            include: ['vue', 'vue/server-renderer'],
          },
          ssr: {
            noExternal: /./,
          },
          resolve: {
            alias,
            dedupe: ['vue'],
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
