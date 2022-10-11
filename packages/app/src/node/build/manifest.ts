import type { App } from 'node/app/App';
import { type AppRoute, toRoute } from 'node/app/routes';
import type {
  ServerLoadableApiRoute,
  ServerLoadablePageRoute,
} from 'server/types';
import {
  compareRoutes,
  getRouteComponentTypes,
  type RouteComponentType,
} from 'shared/routing';
import { stripImportQuotesFromJson } from 'shared/utils/json';
import { noendslash } from 'shared/utils/url';

import type { BuildData } from './build-data';
import { resolveApiChunkMethods } from './chunks';

export function buildServerManifests(app: App, build: BuildData) {
  const baseUrl =
    app.vite.resolved!.base === '/' ? '/' : noendslash(app.vite.resolved!.base);

  const sharedInit: SharedSerializeManifestInit = {
    production: !app.config.debug,
    baseUrl,
    trailingSlash: app.config.routes.trailingSlash,
    entry: build.bundles.server.entry.chunk.fileName,
    document: {
      entry: build.bundles.client.entry.chunk.fileName,
      template: build.template,
    },
  };

  const clientRoutes = app.routes.filterClientRoutes();
  const apiRoutes = app.routes.filterHasType('api');
  const serverConfigs = build.bundles.server.configs;

  const inits = {
    node: createManifestInit(
      build,
      clientRoutes,
      apiRoutes,
      sharedInit,
      Object.values(serverConfigs).map((chunk) => chunk.fileName),
    ),
    edge: createManifestInit(
      build,
      filterEdgePageRoutes(app, build, clientRoutes),
      apiRoutes.filter((route) => build.edge.routes.has(route.id)),
      sharedInit,
      serverConfigs.edge ? [serverConfigs.edge.fileName] : undefined,
    ),
  };

  const dataAssets = new Set<string>();

  for (const key of Object.keys(inits) as (keyof typeof inits)[]) {
    const init = inits[key];
    if (init) {
      for (const hash of Object.keys(init.staticData.serverHashRecord)) {
        dataAssets.add(hash);
      }
    }
  }

  return {
    dataAssets,
    edge: inits.edge ? serializeManifest(inits.edge) : null,
    node: inits.node ? serializeManifest(inits.node) : null,
  };
}

function createManifestInit(
  build: BuildData,
  pageRoutes: AppRoute[],
  apiRoutes: AppRoute[],
  shared: SharedSerializeManifestInit,
  serverConfigs?: string[],
): SerializeManifestInit | null {
  const hasPageRoutes = pageRoutes.length > 0;
  const hasApiRoutes = apiRoutes.length > 0;
  const hasServerConfigs = !!serverConfigs?.length;

  if (!hasPageRoutes && !hasApiRoutes && !hasServerConfigs) return null;

  const clientHashRecord = {};
  const serverHashRecord = {};
  const loaders = {};
  const routeResources = {};

  if (hasPageRoutes) {
    const dataIds = new Set<string>();

    for (const route of pageRoutes) {
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

    for (const route of pageRoutes) {
      const resources = build.resources.routes[route.id];
      if (resources) routeResources[route.id] = resources;
    }
  }

  return {
    ...shared,
    configs: serverConfigs ?? [],
    document: {
      entry: hasPageRoutes ? shared.document.entry : '',
      template: hasPageRoutes ? shared.document.template : '',
      resources: hasPageRoutes
        ? { ...build.resources, routes: routeResources }
        : undefined,
    },
    routes: {
      pages: Array.from(pageRoutes).map((route) => {
        const pageRoute: SerializablePageRoute = toRoute(route);
        const chunks = build.bundles.server.routes.chunks.get(pageRoute.id)!;
        const serverLoaders = build.server.loaders.get(pageRoute.id);

        for (const type of getRouteComponentTypes()) {
          if (route[type]) {
            pageRoute[type] = {
              loader: `() => import('../${chunks[type]!.fileName}')`,
              canFetch: serverLoaders?.[type],
            };
          }
        }

        return { ...pageRoute, pattern: undefined };
      }),
      api: apiRoutes.map((route) => {
        const { fileName } = build.bundles.server.routes.chunks.get(route.id)!
          .api!;

        return {
          ...toRoute(route),
          pathname: route.pathname.replace('{/}?{index}?{.html}?', '{/}?'),
          pattern: undefined,
          loader: `() => import('../${fileName}')`,
          methods: resolveApiChunkMethods(route, build),
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
  production,
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
  production: ${production},
  baseUrl: '${baseUrl}',
  trailingSlash: ${trailingSlash},
  entry: () => import('../${entry}'),
  configs: [${configs.map((_, i) => `serverConfig$${i}`).join(', ')}],
  routes: {
    pages: ${stripImportQuotesFromJson(JSON.stringify(routes.pages, null, 2))},
    api: ${stripImportQuotesFromJson(JSON.stringify(routes.api, null, 2))},
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
  production: boolean;
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
  routes: {
    pages: SerializablePageRoute[];
    api: SerializableApiRoute[];
  };
  document: {
    resources?: BuildData['resources'];
  };
  staticData: {
    loaders: Record<string, string>;
    clientHashRecord: Record<string, string>;
    serverHashRecord: Record<string, string>;
  };
};

type SerializablePageRoute = Omit<
  ServerLoadablePageRoute,
  'pattern' | RouteComponentType
> & {
  [P in RouteComponentType]?: {
    loader: string;
    canFetch?: boolean;
  };
};

type SerializableApiRoute = Omit<
  ServerLoadableApiRoute,
  'loader' | 'pattern'
> & {
  loader: string;
  methods: string[];
};

function filterEdgePageRoutes(
  app: App,
  build: BuildData,
  pageRoutes: AppRoute[],
) {
  const edgePages = pageRoutes.filter((route) =>
    build.edge.routes.has(route.id),
  );

  if (edgePages.length === 0) return [];

  const routes: AppRoute[] = [];
  const seen = new Set<string>();

  // Need the route + branch for layouts and error boundaries.
  for (const route of edgePages) {
    for (const child of app.routes.getBranch(route)) {
      if (!seen.has(child.id)) {
        if (child.client) routes.push(child);
        seen.add(child.id);
      }
    }
  }

  routes.sort(compareRoutes);
  return routes;
}
