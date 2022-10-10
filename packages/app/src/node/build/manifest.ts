import type { App } from 'node/app/App';
import { type AppRoute, toRoute } from 'node/app/routes';
import type { ServerLoadableDocumentRoute } from 'server/types';
import {
  compareRoutes,
  getRouteComponentTypes,
  type RouteComponentType,
} from 'shared/routing';
import { stripImportQuotesFromJson } from 'shared/utils/json';
import { isString } from 'shared/utils/unit';
import { noendslash } from 'shared/utils/url';

import type { BuildData } from './build-data';
import { resolveHttpChunkMethods } from './chunks';

export function buildServerManifests(app: App, build: BuildData) {
  const baseUrl =
    app.vite.resolved!.base === '/' ? '/' : noendslash(app.vite.resolved!.base);

  const sharedInit: SharedSerializeManifestInit = {
    baseUrl,
    trailingSlash: app.config.routes.trailingSlash,
    entry: build.bundles.server.entry.chunk.fileName,
    document: {
      entry: build.bundles.client.entry.chunk.fileName,
      template: build.template,
    },
  };

  const documentRoutes = app.routes.filterDocumentRoutes();
  const httpRoutes = app.routes.filterHasType('http');

  const inits = {
    node: createManifestInit(
      build,
      documentRoutes,
      httpRoutes,
      sharedInit,
      Object.values(build.bundles.server.configs).map(
        (chunk) => chunk.fileName,
      ),
    ),
    edge: createManifestInit(
      build,
      filterEdgeDocumentRoutes(app, build, documentRoutes),
      httpRoutes.filter((route) => build.edge.routes.has(route.id)),
      sharedInit,
      [
        build.bundles.server.configs.shared?.fileName,
        build.bundles.server.configs.edge?.fileName,
      ].filter(isString) as string[],
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
  documentRoutes: AppRoute[],
  httpRoutes: AppRoute[],
  shared: SharedSerializeManifestInit,
  serverConfigs: string[] = [],
): SerializeManifestInit | null {
  const hasDocumentRoutes = documentRoutes.length > 0;
  const hasHttpRoutes = httpRoutes.length > 0;
  const hasServerConfigs = serverConfigs.length > 0;

  if (!hasDocumentRoutes && !hasHttpRoutes && !hasServerConfigs) return null;

  const clientHashRecord = {};
  const serverHashRecord = {};
  const loaders = {};
  const routeResources = {};

  if (hasDocumentRoutes) {
    const dataIds = new Set<string>();

    for (const route of documentRoutes) {
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

    for (const route of documentRoutes) {
      const resources = build.resources.routes[route.id];
      if (resources) routeResources[route.id] = resources;
    }
  }

  return {
    ...shared,
    configs: serverConfigs,
    document: {
      entry: hasDocumentRoutes ? shared.document.entry : '',
      template: hasDocumentRoutes ? shared.document.template : '',
      resources: hasDocumentRoutes
        ? { ...build.resources, routes: routeResources }
        : undefined,
    },
    routes: {
      document: Array.from(documentRoutes).map((route) => {
        const docRoute: SerializableDocumentRoute = toRoute(route);
        const chunks = build.bundles.server.routes.chunks.get(docRoute.id)!;
        const serverLoaders = build.server.loaders.get(docRoute.id);

        for (const type of getRouteComponentTypes()) {
          if (route[type]) {
            docRoute[type] = {
              loader: `() => import('../${chunks[type]!.fileName}')`,
              canFetch: serverLoaders?.[type],
            };
          }
        }

        return { ...docRoute, pattern: undefined };
      }),
      http: httpRoutes.map((route) => {
        const { fileName } = build.bundles.server.routes.chunks.get(route.id)!
          .http!;

        return {
          ...toRoute(route),
          pathname: route.pathname.replace('{/}?{index}?{.html}?', '{/}?'),
          pattern: undefined,
          loader: `() => import('../${fileName}')`,
          methods: resolveHttpChunkMethods(route, build),
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
    resources?: BuildData['resources'];
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
  ServerLoadableDocumentRoute,
  'pattern' | RouteComponentType
> & {
  [P in RouteComponentType]?: {
    loader: string;
    canFetch?: boolean;
  };
};

type SerializableHttpRoute = Omit<
  ServerLoadableDocumentRoute,
  'loader' | 'pattern'
> & {
  loader: string;
  methods: string[];
};

function filterEdgeDocumentRoutes(
  app: App,
  build: BuildData,
  documentRoutes: AppRoute[],
) {
  const edgeRoutes = documentRoutes.filter((route) =>
    build.edge.routes.has(route.id),
  );

  if (edgeRoutes.length === 0) return [];

  const routes: AppRoute[] = [];
  const seen = new Set<string>();

  // Need the route + branch for layouts and error boundaries.
  for (const route of edgeRoutes) {
    for (const child of app.routes.getBranch(route)) {
      if (!seen.has(child.id)) {
        if (child.document) routes.push(child);
        seen.add(child.id);
      }
    }
  }

  routes.sort(compareRoutes);
  return routes;
}
