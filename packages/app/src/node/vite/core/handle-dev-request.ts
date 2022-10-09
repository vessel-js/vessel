import type { ServerResponse } from 'http';
import type { App } from 'node/app/App';
import { type AppRoute, toServerLoadable } from 'node/app/routes';
import { handleIncomingMessage } from 'node/http';
import { createServer } from 'server/http';
import type { ServerEntryModule, ServerManifest } from 'server/types';
import { resolveStaticDataAssetId } from 'shared/data';
import { type JSONData } from 'shared/http';
import { getRouteComponentTypes, matchRoute } from 'shared/routing';
import { coerceError } from 'shared/utils/error';
import type { Connect, ModuleNode, ViteDevServer } from 'vite';

import { handleDevServerError, logDevError } from './dev-server';
import { readIndexHtmlFile } from './index-html';
import { createStaticLoaderFetch, loadStaticRoute } from './static-data-loader';

type HandleDevRequestInit = {
  base: string;
  app: App;
  url: URL;
  req: Connect.IncomingMessage;
  res: ServerResponse;
};

export async function handleDevRequest({
  base,
  app,
  url,
  req,
  res,
}: HandleDevRequestInit) {
  url.pathname = url.pathname.replace('/index.html', '/');

  const serverFetch = createStaticLoaderFetch(app, (route) =>
    route.http!.viteLoader(),
  );

  try {
    const route = matchRoute(url, app.routes.filterHasType('page'));

    const staticDataLoaders: Record<string, () => Promise<{ data: JSONData }>> =
      {};

    if (route) {
      const { matches, redirect } = await loadStaticRoute(
        app,
        url,
        route,
        serverFetch,
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
            const id = resolveStaticDataAssetId(match, type);
            staticDataLoaders[id] = () =>
              Promise.resolve({ data: match[type]!.staticData ?? {} });
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
      baseUrl: app.vite.resolved!.base,
      trailingSlash: app.config.routes.trailingSlash,
      entry: entryLoader,
      configs: await Promise.all(
        app.files.serverConfigs.map((config) => config.viteLoader()),
      ),
      routes: {
        document: app.routes.filterHasType('page').map(toServerLoadable),
        http: app.routes.filterHasType('http').map((route) => ({
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
        clientHashRecord: {},
        serverHashRecord: {},
        loaders: staticDataLoaders,
      },
      devHooks: {
        onDocumentRenderError: (_, error) => {
          if (error instanceof Error) {
            app.vite.server!.ssrFixStacktrace(error);
          }
        },
        onUnexpectedHttpError: (_, error) => {
          if (error instanceof Error) {
            app.vite.server!.ssrFixStacktrace(error);
          }
        },
      },
    };

    const handler = createServer(manifest);
    await handleIncomingMessage(base, req, res, handler, (error) => {
      logDevError(app, req, coerceError(error));
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
