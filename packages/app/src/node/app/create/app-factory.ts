import kleur from 'kleur';
import { MarkdocSchema } from 'node/markdoc/markdoc-schema';
import { logger, trimExt } from 'node/utils';
import type { VesselPlugin } from 'node/vite/Plugin';
import * as path from 'pathe';
import { installURLPattern } from 'shared/polyfills';
import {
  type ConfigEnv,
  mergeConfig,
  type UserConfig as ViteUserConfig,
} from 'vite';

import type { App, AppDetails, AppFactory } from '../App';
import {
  type AppConfig,
  resolveAppConfig,
  type ResolvedAppConfig,
} from '../config';
import { AppFiles } from '../files';
import { AppRoutes } from '../routes';
import { createAppDirectories } from './app-dirs';
import { getAppVersion } from './app-utils';
import { DisposalBin } from './disposal-bin';

export const createAppFactory = async (
  config: AppConfig,
  viteConfig: ViteUserConfig,
  env: ConfigEnv,
): Promise<AppFactory> => {
  await installURLPattern();

  const root = viteConfig.root ?? process.cwd();

  const resolvedConfig = resolveAppConfig(root, config);
  resolvedConfig.isBuild = env.command === 'build';
  resolvedConfig.isSSR = !!viteConfig.build?.ssr;

  const dirs = createAppDirectories(root, resolvedConfig);
  const version = getAppVersion();

  let plugins = viteConfig
    .plugins!.flat()
    .filter((plugin) => plugin && 'vessel' in plugin) as VesselPlugin[];

  plugins = [
    ...plugins.filter((plugin) => plugin.enforce === 'pre'),
    ...plugins.filter((plugin) => !plugin.enforce),
    ...plugins.filter((plugin) => plugin.enforce === 'post'),
  ];

  const details: AppDetails = {
    version,
    dirs,
    config: { ...resolvedConfig },
    vite: { env },
  };

  const app: AppFactory = {
    ...details,
    create: async () => {
      const $app: App = {
        ...details,
        logger,
        vite: { user: viteConfig, env },
        context: new Map(),
        files: new AppFiles(),
        routes: new AppRoutes(),
        markdoc: new MarkdocSchema(),
        disposal: new DisposalBin(),
        destroy: () => $app.disposal.empty(),
      };

      for (const plugin of plugins) {
        const overrides = await plugin.vessel!.config?.($app.config);
        if (overrides) {
          $app.config = mergeConfig(
            $app.config,
            overrides,
          ) as ResolvedAppConfig;
        }
      }

      if (!$app.config.entry.client || !$app.config.entry.server) {
        const frameworkPlugins = ['svelte', 'vue', 'preact', 'solid']
          .map((fw) => `@vessel-js/${fw}`)
          .map((fw) => kleur.cyan(`- npm i ${fw}`))
          .join('\n');

        throw Error(
          [
            kleur.red(`Missing client/server entries.`),
            kleur.bold(
              "\n1. Make sure you've installed a framework-specific plugin:",
            ),
            `\n${frameworkPlugins}`,
            kleur.bold(
              "\n2. Next, check if you've added the plugin to `vite.config.*`.",
            ),
            '',
          ].join('\n'),
        );
      }

      app.config.entry.client = path.normalize(app.config.entry.client);
      app.config.entry.server = path.normalize(app.config.entry.server);

      for (const plugin of plugins) {
        await plugin.vessel?.configureApp?.($app);
      }

      return $app;
    },
  };

  return app;
};

export function createAppEntries(app: App, { isSSR = false } = {}) {
  const entries: Record<string, string> = {};

  const files =
    isSSR || app.config.isSSR
      ? app.files.routes.toArray()
      : app.files.routes.toArray().filter((file) => file.type !== 'api');

  for (const file of files) {
    const name = trimExt(file.path.route);
    entries[`nodes/${name}`] = file.path.absolute;
  }

  if (isSSR || app.config.isSSR) {
    for (const config of app.files.serverConfigs) {
      entries[`.server/${config.type}`] = config.path;
    }
  }

  return entries;
}
