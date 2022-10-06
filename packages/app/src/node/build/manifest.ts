import type { App } from 'node/app/App';
import { type AppRoute, toRoute } from 'node/app/routes';
import type { ServerLoadableRoute } from 'server/types';
import {
  compareRoutes,
  getRouteComponentTypes,
  type RouteComponentType,
} from 'shared/routing';
import { stripImportQuotesFromJson } from 'shared/utils/json';
import { noendslash } from 'shared/utils/url';

import type { BuildBundles, BuildData } from './build-data';
import { resolveHttpChunkMethods } from './chunks';

export function buildServerManifests(
  app: App,
  bundles: BuildBundles,
  build: BuildData,
) {
  const documentRoutes = app.routes
    .toArray()
    .filter((route) => build.server.loaders.has(route.id));
  const httpRoutes = app.routes.filterHasType('http');
  const edgeRouteIds = build.edge.routes;

  if (documentRoutes.length === 0 && httpRoutes.length === 0) {
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
      documentRoutes,
      httpRoutes,
      sharedInit,
    ),
    node: createManifestInit(
      app,
      build,
      documentRoutes.filter((route) => !edgeRouteIds.has(route.id)),
      httpRoutes.filter((route) => !edgeRouteIds.has(route.id)),
      sharedInit,
    ),
    edge: createManifestInit(
      app,
      build,
      documentRoutes.filter((route) => edgeRouteIds.has(route.id)),
      httpRoutes.filter((route) => edgeRouteIds.has(route.id)),
      sharedInit,
    ),
  };

  const dataAssets = new Set<string>();

  for (const key of Object.keys(inits) as (keyof typeof inits)[]) {
    const init = inits[key];
    if (init) {
      for (const hash of Object.keys(init.staticData.serverHashRecord)) {
        dataAssets.add(hash);
      }

      if (key === 'preview') {
        init.configs = Object.values(build.server.configChunks).map(
          (chunk) => chunk.fileName,
        );
      } else {
        if (build.server.configChunks.shared) {
          init.configs.push(build.server.configChunks.shared.fileName);
        }

        if (build.server.configChunks[key]) {
          init.configs.push(build.server.configChunks[key]!.fileName);
        }
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
  documentRoutes: AppRoute[],
  httpRoutes: AppRoute[],
  shared: SharedSerializeManifestInit,
): SerializeManifestInit | null {
  const hasDocumentRoutes = documentRoutes.length > 0;
  const hasHttpRoutes = httpRoutes.length > 0;
  if (!hasDocumentRoutes && !hasHttpRoutes) return null;

  const clientHashRecord = {};
  const serverHashRecord = {};
  const loaders = {};

  // We need to not only include the given routes but their layout branches.
  const seen = new Set<string>();
  const routes: AppRoute[] = [];

  if (hasDocumentRoutes) {
    for (const route of documentRoutes) {
      for (const child of app.routes.getBranch(route)) {
        if (!seen.has(child.id)) {
          routes.push(child);
          seen.add(child.id);
        }
      }
    }

    routes.sort(compareRoutes);
  }

  if (hasDocumentRoutes) {
    const dataIds = new Set<string>();

    for (const route of routes) {
      const ids = build.static.routeData.get(route.id);
      if (ids) for (const id of ids) dataIds.add(id);
    }

    for (const id of dataIds) {
      const hashedId = build.static.serverHashRecord[id];
      const contentHash = build.static.clientHashRecord[hashedId];
      if (hashedId) {
        serverHashRecord[id] = hashedId;
        clientHashRecord[hashedId] = contentHash;
        loaders[hashedId] = `() => import('../.data/${contentHash}.js')`;
      }
    }
  }

  const routeResources = {};
  for (const route of routes) {
    const resources = build.resources.routes[route.id];
    if (resources) routeResources[route.id] = resources;
  }

  return {
    ...shared,
    configs: [],
    document: {
      entry: hasDocumentRoutes ? shared.document.entry : '',
      template: hasDocumentRoutes ? shared.document.template : '',
      resources: hasDocumentRoutes
        ? { ...build.resources, routes: routeResources }
        : { all: [], entry: [], app: [], routes: {} },
    },
    routes: {
      document: Array.from(routes).map((appRoute) => {
        const route: SerializableDocumentRoute = toRoute(appRoute);
        const chunks = build.server.chunks.get(route.id)!;
        const serverLoaders = build.server.loaders.get(route.id);

        for (const type of getRouteComponentTypes()) {
          if (appRoute[type]) {
            route[type] = {
              loader: `() => import('../${chunks[type]!.fileName}')`,
              canFetch: serverLoaders?.[type],
            };
          }
        }

        return { ...route, pattern: undefined };
      }),
      http: httpRoutes.map((appRoute) => {
        const { fileName } = build.server.chunks.get(appRoute.id)!.http!;
        return {
          ...toRoute(appRoute),
          pattern: undefined,
          loader: `() => import('../${fileName}')`,
          methods: resolveHttpChunkMethods(appRoute, build),
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
  document,
  entry,
  configs,
  routes,
  staticData,
}: SerializeManifestInit) {
  const configImports = configs
    .map((config, i) => `import serverConfig$${i} from "../${config}";`)
    .join('\n');

  return `${configImports}
export default {
  baseUrl: '${baseUrl}',
  trailingSlash: ${trailingSlash},
  entry: () => import('../${entry}'),
  configs: [${configs.map((_, i) => `serverConfig$${i}`).join(', ')}],
  routes: {
    document: ${stripImportQuotesFromJson(
      JSON.stringify(routes.document, null, 2),
    )},
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
  configs: string[];
  document: {
    resources: BuildData['resources'];
  };
  routes: {
    document: SerializableDocumentRoute[];
    http: SerializableHttpRoute[];
  };
  staticData: {
    loaders: Record<string, string>;
    clientHashRecord: Record<string, string>;
    serverHashRecord: Record<string, string>;
  };
};

type SerializableDocumentRoute = Omit<
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
