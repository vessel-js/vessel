import type { ServerManifest } from 'server/types';
import { compareRoutes } from 'shared/routing';

import {
  createServerRouter,
  type ServerApp,
  type ServerRouter,
} from './server-router';

export function configureServer(
  init: (app: { app: ServerApp; router: ServerRouter }) => void,
) {
  const { app, router, ...manifest } = createServerRouter();
  init({ app, router });
  return manifest;
}

export type ServerConfig = ReturnType<typeof configureServer>;

export function installServerConfig(
  manifest: Partial<ServerManifest>,
  config: ServerConfig,
) {
  if (!manifest.middlewares) manifest.middlewares = [];
  manifest.middlewares.push(...config.middlewares);

  if (!manifest.errorHandlers) {
    manifest.errorHandlers = { document: [], api: [] };
  }

  for (const type of ['document', 'api'] as const) {
    if (!manifest.errorHandlers[type]) {
      manifest.errorHandlers[type] = [];
    }

    if (config.errorHandlers[type].length > 0) {
      manifest.errorHandlers[type]!.push(
        ...config.errorHandlers[type].map(addURLPattern),
      );

      manifest.errorHandlers[type]!.sort(compareRoutes);
    }
  }

  if (config.httpRoutes.length > 0) {
    manifest.routes!.http!.push(...config.httpRoutes.map(addURLPattern));
    manifest.routes!.http!.sort(compareRoutes);
  }
}

export function addURLPattern<
  T extends { pathname: string; pattern?: URLPattern },
>(route: T) {
  if (!route.pattern) {
    route.pattern = new URLPattern({ pathname: route.pathname });
  }

  return route as T & { pattern: URLPattern };
}
