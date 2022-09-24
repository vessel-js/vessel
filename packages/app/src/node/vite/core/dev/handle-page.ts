import type { ServerResponse } from 'http';
import type { App } from 'node/app/App';
import { type AppRoute, toServerLoadable } from 'node/app/routes';
import { handleHTTPRequest } from 'node/http';
import { createPageHandler, JSONData } from 'server/http';
import type { ServerEntryModule, ServerManifest } from 'server/types';
import { getRouteComponentTypes, matchRoute } from 'shared/routing';
import { coerceToError } from 'shared/utils/error';
import type { Connect, ModuleNode, ViteDevServer } from 'vite';

import { readIndexHtmlFile } from '../index-html';
import {
  createStaticLoaderFetcher,
  loadStaticRoute,
} from '../static-data-loader';
import { handleDevServerError, logDevError } from './server';

type HandlePageRequestInit = {
  base: string;
  app: App;
  url: URL;
  req: Connect.IncomingMessage;
  res: ServerResponse;
};

export async function handlePageRequest({
  base,
  app,
  url,
  req,
  res,
}: HandlePageRequestInit) {
  url.pathname = url.pathname.replace('/index.html', '/');

  const fetcher = createStaticLoaderFetcher(app, (route) =>
    app.vite.server!.ssrLoadModule(route.http!.path.absolute),
  );

  try {
    const route = matchRoute(url, app.routes.filterByType('page'));
    const staticData: Record<string, JSONData> = {};

    if (route) {
      const { matches, redirect } = await loadStaticRoute(
        app,
        url,
        route,
        fetcher,
        (route, type) => route[type]!.viteLoader(),
      );

      if (redirect) {
        res.statusCode = redirect.status;
        res.setHeader('Location', redirect.path);
        res.end();
        return;
      }

      for (const match of matches) {
        for (const type of getRouteComponentTypes()) {
          if (match[type]?.staticData) {
            staticData[match.id + type] = match[type]!.staticData!;
          }
        }
      }
    }

    const template = await app.vite.server!.transformIndexHtml(
      decodeURI(url.pathname),
      readIndexHtmlFile(app),
      req.originalUrl,
    );

    const entryLoader = async () =>
      (await app.vite.server!.ssrLoadModule(
        app.config.entry.server,
      )) as ServerEntryModule;

    const manifest: ServerManifest = {
      dev: true,
      entry: entryLoader,
      baseUrl: app.vite.resolved!.base,
      trailingSlash: app.config.routes.trailingSlash,
      routes: {
        app: app.routes.toArray().map(toServerLoadable),
        http: app.routes.filterByType('http').map((route) => ({
          ...route,
          loader: route.http!.viteLoader,
        })),
      },
      document: {
        entry: '/:virtual/vessel/client',
        template,
        // Currently not used in dev.
        resources: {
          all: [],
          entry: [],
          app: [],
          routes: {},
        },
        devStylesheets: () => resolveDevStylesheet(app, route),
      },
      staticData: {
        hashMap: '',
        loader: async (_, route, type) => staticData[route.id + type],
      },
    };

    const handler = createPageHandler(manifest);
    await handleHTTPRequest(base, req, res, handler, (error) => {
      logDevError(app, req, coerceToError(error));
    });
  } catch (error) {
    handleDevServerError(app, req, res, error);
  }
}

async function resolveDevStylesheet(app: App, route?: AppRoute | null) {
  if (!route) return '';

  const stylesMap = await Promise.all(
    [
      app.config.client.app,
      ...app.routes
        .getLayoutBranch(route)
        .map((layout) => layout.path.absolute),
      route.page!.path.absolute,
    ].map((file) => getStylesByFile(app.vite.server!, file)),
  );

  // Prevent FOUC during development.
  return [
    '<style id="__VSL_SSR_STYLES__" type="text/css">',
    stylesMap.map(Object.values).flat().join('\n'),
    '</style>',
  ].join('\n');
}

// Vite doesn't expose this so we just copy the list for now
const styleRE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss)$/;
export async function getStylesByFile(server: ViteDevServer, file: string) {
  const files = await server.moduleGraph.getModulesByFile(file);
  const node = Array.from(files ?? [])[0];

  if (!node) return {};

  const deps = new Set<ModuleNode>();
  await findModuleDeps(server, node, deps);

  const styles: Record<string, string> = {};

  for (const dep of deps) {
    const parsed = new URL(dep.url, 'http://localhost/');
    const query = parsed.searchParams;

    if (
      styleRE.test(dep.file!) ||
      (query.has('svelte') && query.get('type') === 'style') ||
      (query.has('vue') && query.get('type') === 'style')
    ) {
      try {
        const mod = await server.ssrLoadModule(dep.url);
        styles[dep.url] = mod.default;
      } catch {
        // no-op
      }
    }
  }

  return styles;
}

export async function findModuleDeps(
  server: ViteDevServer,
  node: ModuleNode,
  deps: Set<ModuleNode>,
) {
  const edges: Promise<void>[] = [];

  async function add(node: ModuleNode) {
    if (!deps.has(node)) {
      deps.add(node);
      await findModuleDeps(server, node, deps);
    }
  }

  async function addByUrl(url: string) {
    const node = await server.moduleGraph.getModuleByUrl(url);
    if (node) await add(node);
  }

  if (node.ssrTransformResult) {
    if (node.ssrTransformResult.deps) {
      node.ssrTransformResult.deps.forEach((url) => edges.push(addByUrl(url)));
    }
  } else {
    node.importedModules.forEach((node) => edges.push(add(node)));
  }

  await Promise.all(edges);
}
