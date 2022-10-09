import type { App } from 'node/app/App';
import { toServerLoadable } from 'node/app/routes';
import { installServerConfigs } from 'server/http/app/configure-server';
import type { ServerEntryModule, ServerManifest } from 'server/types';

export function initDevServerManifest(app: App): ServerManifest {
  const entryLoader = async () =>
    (await app.vite.server!.ssrLoadModule(
      app.config.entry.server,
    )) as ServerEntryModule;

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
    dev: {
      onDocumentRenderError: fixStacktrace,
      onUnexpectedHttpError: fixStacktrace,
    },
    routes: {
      document: [],
      http: [],
    },
    document: {
      entry: '/:virtual/vessel/client',
      template: '',
    },
    staticData: {},
  };
}

export async function updateDevServerManifestRoutes(
  app: App,
  manifest: ServerManifest,
) {
  manifest.routes = {
    document: app.routes.toArray().map(toServerLoadable),
    http: app.routes.filterHasType('http').map((route) => ({
      ...route,
      loader: route.http!.viteLoader,
    })),
  };

  manifest.configs = await Promise.all(
    app.files.serverConfigs.map((config) => config.viteLoader()),
  );

  installServerConfigs(manifest);
}
