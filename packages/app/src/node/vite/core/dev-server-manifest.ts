import type { App } from 'node/app/App';
import { toServerLoadable } from 'node/app/routes';
import { installServerConfigs } from 'server/http/app/configure-server';
import type { ServerEntryModule, ServerManifest } from 'server/types';

export function initDevServerManifest(app: App): ServerManifest {
  const entryLoader = async () =>
    (await app.vite.server!.ssrLoadModule(app.config.entry.server)) as ServerEntryModule;

  const fixStacktrace = (error: unknown) => {
    if (error instanceof Error) {
      app.vite.server!.ssrFixStacktrace(error);
    }
  };

  return {
    production: false,
    baseUrl: app.vite.resolved!.base,
    trailingSlash: app.config.routes.trailingSlash,
    entry: entryLoader,
    configs: [],
    staticData: {},
    routes: {
      pages: [],
      api: [],
    },
    document: {
      entry: '/:virtual/vessel/client',
      template: '',
    },
    dev: {
      onPageRenderError: fixStacktrace,
      onApiError: fixStacktrace,
    },
  };
}

export async function updateDevServerManifestRoutes(app: App, manifest: ServerManifest) {
  manifest.middlewares = [];
  manifest.errorHandlers = {};

  manifest.routes = {
    pages: app.routes.toArray().map(toServerLoadable),
    api: app.routes.filterHasType('api').map((route) => ({
      ...route,
      loader: route.api!.viteLoader,
    })),
  };

  manifest.configs = await Promise.all(
    app.files.serverConfigs.map((config) => config.viteLoader()),
  );

  installServerConfigs(manifest);
}
