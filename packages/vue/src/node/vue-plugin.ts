import { type VesselPlugins, VM_PREFIX } from '@vessel-js/app/node';
import { globbySync } from 'globby';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { renderMarkdoc, transformTreeNode, vueMarkdocTags } from './markdoc';

const VIRTUAL_APP_ID = `${VM_PREFIX}/vue/app` as const;

export function vuePlugin(): VesselPlugins {
  let appDir: string;

  const require = createRequire(import.meta.url);

  function resolveAppId() {
    const exts = ['vue', 'ts', 'js'].join(', ');
    const file = globbySync([`app.{${exts}}`, `+app.{${exts}}`], {
      cwd: appDir,
    })[0];
    return file && fs.existsSync(file)
      ? { id: file }
      : { id: require.resolve('@vessel-js/vue/+app.js') };
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
