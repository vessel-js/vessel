import type { App } from 'node/app/App';
import { AppRoute, toRoute } from 'node/app/routes';
import { HTTP_METHODS } from 'server/http';
import type { ServerLoadableRoute } from 'server/types';
import {
  getRouteComponentTypes,
  type RouteComponentType,
} from 'shared/routing';
import { stripImportQuotesFromJson } from 'shared/utils/json';
import { noendslash } from 'shared/utils/url';

import type { BuildBundles, BuildData } from './build-data';

export function buildServerManifests(
  app: App,
  bundles: BuildBundles,
  build: BuildData,
) {
  const serverRoutes = app.routes
    .toArray()
    .filter((route) => build.server.loaders.has(route.id));
  const serverHttpRoutes = app.routes.filterHasType('http');
  const edgeRoutes = build.edge.routes;

  if (serverRoutes.length === 0 && serverHttpRoutes.length === 0) {
    return null;
  }

  const baseUrl =
    app.vite.resolved!.base === '/' ? '/' : noendslash(app.vite.resolved!.base);

  const sharedInit: SharedSerializeManifestInit = {
    baseUrl,
    trailingSlash: app.config.routes.trailingSlash,
    entry: bundles.server.entry.chunk.fileName,
    document: {
      entry: bundles.client.entry.chunk.fileName,
      template: build.template,
    },
  };

  const inits = {
    preview: createManifestInit(
      app,
      build,
      serverRoutes,
      serverHttpRoutes,
      sharedInit,
    ),
    edge: createManifestInit(
      app,
      build,
      serverRoutes.filter((route) => edgeRoutes.has(route.id)),
      serverHttpRoutes.filter((route) => edgeRoutes.has(route.id)),
      sharedInit,
    ),
    node: createManifestInit(
      app,
      build,
      serverRoutes.filter((route) => !edgeRoutes.has(route.id)),
      serverHttpRoutes.filter((route) => !edgeRoutes.has(route.id)),
      sharedInit,
    ),
  };

  const dataAssets = new Set<string>();

  for (const key of Object.keys(inits)) {
    if (inits[key]) {
      const init = inits[key];
      for (const hash of Object.keys(init.staticData.serverHashRecord)) {
        dataAssets.add(hash);
      }
    }
  }

  return {
    dataAssets,
    preview: inits.preview ? serializeManifest(inits.preview) : null,
    edge: inits.edge ? serializeManifest(inits.edge) : null,
    node: inits.node ? serializeManifest(inits.node) : null,
  };
}

function createManifestInit(
  app: App,
  build: BuildData,
  appRoutes: AppRoute[],
  httpRoutes: AppRoute[],
  shared: SharedSerializeManifestInit,
): SerializeManifestInit | null {
  const hasAppRoutes = appRoutes.length > 0;
  const hasHttpRoutes = httpRoutes.length > 0;
  if (!hasAppRoutes && !hasHttpRoutes) return null;

  const clientHashRecord = {};
  const serverHashRecord = {};
  const loaders = {};

  // We need to not only include the given routes but their layout branches.
  const allRoutes = new Set<AppRoute>();

  if (hasAppRoutes) {
    for (const route of app.routes) {
      for (const parent of app.routes.getBranch(route)) {
        if (parent.layout || parent.errorBoundary) {
          allRoutes.add({ ...parent, page: undefined });
        }
      }

      allRoutes.add(route);
    }
  }

  if (hasAppRoutes) {
    const dataIds = new Set<string>();

    for (const route of allRoutes) {
      const ids = build.static.routeData.get(route.id);
      if (ids) for (const id of ids) dataIds.add(id);
    }

    for (const id of dataIds) {
      const hashedId = build.static.serverHashRecord[id];
      const contentHash = build.static.clientHashRecord[hashedId];
      if (hashedId) {
        serverHashRecord[id] = hashedId;
        clientHashRecord[hashedId] = contentHash;
        loaders[hashedId] = `() => import('./_data/${contentHash}.js')`;
      }
    }
  }

  const routeResources = {};
  for (const route of allRoutes) {
    const resources = build.resources.routes[route.id];
    if (resources) routeResources[route.id] = resources;
  }

  return {
    ...shared,
    document: {
      entry: hasAppRoutes ? shared.document.entry : '',
      template: hasAppRoutes ? shared.document.template : '',
      resources: hasAppRoutes
        ? { ...build.resources, routes: routeResources }
        : { all: [], entry: [], app: [], routes: {} },
    },
    routes: {
      app: Array.from(allRoutes).map((appRoute) => {
        const route: SerializableAppRoute = toRoute(appRoute);
        const chunks = build.server.chunks.get(route.id)!;
        const serverLoaders = build.server.loaders.get(route.id);

        for (const type of getRouteComponentTypes()) {
          if (appRoute[type]) {
            route[type] = {
              loader: `() => import('./${chunks[type]!.fileName}')`,
              canFetch: serverLoaders?.[type],
            };
          }
        }

        return { ...route, pattern: undefined };
      }),
      http: httpRoutes.map((appRoute) => {
        const { fileName } = build.server.chunks.get(appRoute.id)!.http!;
        const chunk = build.server.chunks.get(appRoute.id)!.http!;
        const methods = chunk.exports.filter((id) => HTTP_METHODS.has(id));
        return {
          ...toRoute(appRoute),
          pattern: undefined,
          loader: `() => import('./${fileName}')`,
          methods,
        };
      }),
    },
    staticData: {
      clientHashRecord,
      serverHashRecord,
      loaders,
    },
  };
}

function serializeManifest({
  baseUrl,
  trailingSlash,
  entry,
  document,
  routes,
  staticData,
}: SerializeManifestInit) {
  return `export default {
  baseUrl: '${baseUrl}',
  trailingSlash: ${trailingSlash},
  entry: () => import('./${entry}'),
  routes: {
    app: ${stripImportQuotesFromJson(JSON.stringify(routes.app, null, 2))},
    http: ${stripImportQuotesFromJson(JSON.stringify(routes.http, null, 2))},
  },
  document: {
    entry: '/${document.entry}',
    template: ${JSON.stringify(document.template)},
    resources: ${JSON.stringify(document.resources, null, 2)},
  },
  staticData: {
    loaders: ${stripImportQuotesFromJson(
      JSON.stringify(staticData.loaders, null, 2),
    )},
    clientHashRecord: ${JSON.stringify(staticData.clientHashRecord, null, 2)},
    serverHashRecord: ${JSON.stringify(staticData.serverHashRecord, null, 2)},
  },
};`;
}

type SharedSerializeManifestInit = {
  baseUrl: string;
  trailingSlash: boolean;
  entry: string;
  document: {
    entry: string;
    template: string;
  };
};

type SerializeManifestInit = SharedSerializeManifestInit & {
  document: {
    resources: BuildData['resources'];
  };
  routes: {
    app: SerializableAppRoute[];
    http: SerializableHttpRoute[];
  };
  staticData: {
    loaders: Record<string, string>;
    clientHashRecord: Record<string, string>;
    serverHashRecord: Record<string, string>;
  };
};

type SerializableAppRoute = Omit<
  ServerLoadableRoute,
  'pattern' | RouteComponentType
> & {
  [P in RouteComponentType]?: {
    loader: string;
    canFetch?: boolean;
  };
};

type SerializableHttpRoute = Omit<ServerLoadableRoute, 'loader' | 'pattern'> & {
  loader: string;
  methods: string[];
};
