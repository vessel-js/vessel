import kleur from 'kleur';
import ora from 'ora';
import * as path from 'pathe';
import type { OutputBundle } from 'rollup';
import type { Plugin as VitePlugin, ResolvedConfig as ViteResolvedConfig } from 'vite';

import type { App, AppFactory } from 'node/app/App';
import type { AppConfig } from 'node/app/config';
import { createAppFactory } from 'node/app/create/app-factory';
import { build, createServerBundle, resolveBuildConfig } from 'node/build';
import { installPolyfills } from 'node/polyfills';
import { LoggerIcon, rimraf } from 'node/utils';

import { virtualAliases, virtualModuleRequestPath } from './alias';
import { configureDevServer } from './core/dev-server';
import { configurePreviewServer } from './core/preview-server';
import { filesPlugin } from './files/files-plugin';
import { markdownPlugin } from './markdown/markdown-plugin';
import { removeLoadersPlugin } from './remove-loaders-plugin';
import { rpcPlugin } from './rpc-plugin';

const clientPackages = [
  '@vessel-js/app',
  '@vessel-js/svelte',
  '@vessel-js/vue',
  '@vessel-js/preact',
  // '@vessel-js/react',
  '@vessel-js/solid',
  'urlpattern-polyfill/urlpattern',
];

export interface VesselPluginConfig extends AppConfig {}

export function vesselPlugin(config: VesselPluginConfig = {}): VitePlugin[] {
  let app: App, appFactory: AppFactory, viteConfig: ViteResolvedConfig;

  let isFirstBuild = true,
    clientBundle: OutputBundle | null = null,
    serverBundle: OutputBundle | null = null;

  const clientBundleSpinner = ora(),
    serverBundeSpinner = ora();

  return [
    {
      name: 'vessel',
      enforce: 'pre',
      async config(viteConfig, env) {
        appFactory = await createAppFactory(config, viteConfig, env);
        app = await appFactory.create();
        return {
          ...resolveBuildConfig(app),
          appType: 'custom',
          envPrefix: 'PUBLIC_',
          resolve: { alias: virtualAliases },
          optimizeDeps: { exclude: clientPackages },
          ssr: { noExternal: clientPackages },
          server: {
            fs: {
              allow: [
                path.dirname(app.config.entry.client),
                path.dirname(app.config.entry.server),
                app.dirs.cwd.path,
                app.dirs.root.path,
                app.dirs.app.path,
                app.dirs.public.path,
                app.dirs.build.path,
                app.dirs.vessel.root.path,
                app.dirs.cwd.resolve('node_modules'),
                app.dirs.workspace.resolve('node_modules'),
              ],
            },
          },
        };
      },
      async configResolved(_viteConfig) {
        viteConfig = _viteConfig;
        app.vite.resolved = _viteConfig;
      },
      async configureServer(server) {
        await installPolyfills();
        app.vite.server = server;
        const { pre, post } = await configureDevServer(app, server);
        pre();
        return () => {
          post();
        };
      },
      async configurePreviewServer(server) {
        const { pre, post } = await configurePreviewServer(app, server);
        pre();
        return () => {
          post();
        };
      },
      resolveId(id) {
        if (id === virtualModuleRequestPath.client) {
          return { id: app.config.entry.client };
        }

        if (id === virtualModuleRequestPath.noop || id === virtualModuleRequestPath.config) {
          return id;
        }

        return null;
      },
      async load(id) {
        if (id === virtualModuleRequestPath.config) {
          const id = app.config.client.app;
          const baseUrl = app.vite.resolved!.base;
          return ['export default {', `  id: "${id}",`, `  baseUrl: "${baseUrl}",`, `};`].join(
            '\n',
          );
        }

        if (id === virtualModuleRequestPath.noop) {
          return `export default function() {};`;
        }

        return null;
      },
      async buildStart() {
        if (app.config.isSSR) return;

        // Reset for new build. Goes here because `build --watch` calls buildStart but not config.
        clientBundle = null;
        clientBundleSpinner.start(kleur.bold('Bundling client...'));

        if (app.config.isBuild) {
          rimraf(app.dirs.vessel.client.path);
          rimraf(app.dirs.vessel.server.path);
          rimraf(app.dirs.build.path);

          // Skip first build because $app is initialized in `configResolved` hook.
          if (!isFirstBuild) {
            app = await appFactory.create();
            app.vite.resolved = viteConfig;
          }

          isFirstBuild = false;
        }
      },
      async writeBundle(_, bundle) {
        if (app.config.isSSR) return;

        clientBundle = bundle;
        clientBundleSpinner.stopAndPersist({
          symbol: LoggerIcon.Success,
          text: kleur.bold(`Bundled client`),
        });

        serverBundeSpinner.start(kleur.bold('Bundling server...'));
        await createServerBundle((bundle) => {
          serverBundle = bundle;
        });
        serverBundeSpinner.stopAndPersist({
          symbol: LoggerIcon.Success,
          text: kleur.bold(`Bundled server`),
        });
      },
      async closeBundle() {
        // Vite calls `closeBundle` when dev server restarts so we ignore it.
        if (app.config.isSSR || !clientBundle || !app || !serverBundle) {
          app?.destroy();
          return;
        }

        await build(app, clientBundle, serverBundle);
        clientBundle = null;
        serverBundle = null;
        app.destroy();
      },
      generateBundle(_, bundle) {
        // SSR build - delete all assets.
        if (app.config.isSSR) {
          for (const name in bundle) {
            if (bundle[name].type === 'asset') {
              delete bundle[name];
            }
          }
        }
      },
    },
    rpcPlugin(),
    removeLoadersPlugin(),
    markdownPlugin(),
    filesPlugin(),
  ];
}
