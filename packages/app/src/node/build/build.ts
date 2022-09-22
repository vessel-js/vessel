import kleur from 'kleur';
import type { App } from 'node/app/App';
import { createAppEntries } from 'node/app/create/app-factory';
import { getRouteFileTypes, RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import { createStaticLoaderFetcher, loadStaticRoute } from 'node/vite/core';
import { getDevServerOrigin } from 'node/vite/core/dev-server';
import fs from 'node:fs';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import { createStaticLoaderDataMap } from 'server';
import { createServerRouter } from 'server/http';
import { installPolyfills } from 'server/polyfills';
import type {
  ServerEntryModule,
  ServerLoadedRoute,
  ServerRenderResult,
} from 'server/types';
import { cleanRoutePath, findRoute } from 'shared/routing';
import { isFunction } from 'shared/utils/unit';
import { type Manifest as ViteManifest } from 'vite';

import { createAutoBuildAdapter, getBuildAdapterUtils } from './adapter';
import { resolveLoaderChunks } from './chunks';

export async function build(
  app: App,
  clientBundle: OutputBundle,
  serverBundle: OutputBundle,
): Promise<void> {
  const pageRoutes = app.routes.filterByType('page');

  if (pageRoutes.length === 0) {
    console.log(kleur.bold(`❓ No pages were resolved`));
    return;
  }

  await installPolyfills();

  const ssrOrigin = getDevServerOrigin(app);

  const entries = createAppEntries(app, { isSSR: true });
  const viteManifestPath = app.dirs.client.resolve('vite-manifest.json');
  const { chunks, assets } = collectOutput(clientBundle);

  const entryChunk = chunks.find(
    (chunk) => chunk.isEntry && /^_immutable\/entry-/.test(chunk.fileName),
  )!;
  const appChunk = chunks.find(
    (chunk) => chunk.isEntry && /^_immutable\/app-/.test(chunk.fileName),
  )!;
  const appCSSAsset = assets.find((asset) => asset.fileName.endsWith('.css'))!;

  const bundles: BuildBundles = {
    entries,
    client: {
      output: clientBundle,
      entryChunk,
      appChunk,
      appCSSAsset,
      chunks,
      assets,
      viteManifest: JSON.parse(
        await fs.promises.readFile(viteManifestPath, 'utf-8'),
      ),
    },
    server: {
      output: serverBundle,
      chunks: collectChunks(serverBundle),
    },
  };

  console.log();

  const httpRoutes = app.routes.filterByType('http');

  const build: BuildData = {
    entries,
    links: new Map(),
    badLinks: new Map(),
    staticPages: new Set(),
    staticData: new Map(),
    staticRedirects: new Map(),
    staticRenders: new Map(),
    serverPages: new Set(),
    serverHttpEndpoints: new Set(httpRoutes),
    routeChunks: new Map(),
    routeChunkFile: new Map(),
    ...resolveLoaderChunks(app, bundles.server),
  };

  // staticPages + serverPages
  for (const pageRoute of pageRoutes) {
    const branch = app.routes.getBranch(pageRoute);
    if (branch.some((route) => build.serverLoaderRoutes.has(route))) {
      build.serverPages.add(pageRoute);
    } else {
      build.staticPages.add(pageRoute);
    }
  }

  for (const route of app.routes) {
    const chunks = {};
    const files = {};

    for (const type of getRouteFileTypes()) {
      if (route[type]) {
        const chunk = bundles.server.chunks.find(
          (chunk) => chunk.facadeModuleId === route[type]!.path.absolute,
        );
        if (chunk) {
          chunks[type] = chunk;
          files[type] = app.dirs.server.resolve(chunk.fileName);
        }
      }
    }

    build.routeChunks.set(route.id, chunks);
    build.routeChunkFile.set(route.id, files);
  }

  const $ = getBuildAdapterUtils(app, bundles, build);

  const adapterFactory = isFunction(app.config.build.adapter)
    ? app.config.build.adapter
    : createAutoBuildAdapter(app.config.build.adapter);

  const adapter = await adapterFactory(app, bundles, build, $);

  // -------------------------------------------------------------------------------------------
  // LOAD DATA
  // -------------------------------------------------------------------------------------------

  const fetcher = createStaticLoaderFetcher(
    app,
    (route) => import(build.routeChunkFile.get(route.id)!.http!),
  );

  const serverRouter = createServerRouter();

  const routeChunkLoader = (route: AppRoute, type: RouteFileType) =>
    import(build.routeChunkFile.get(route.id)![type]!);

  async function loadRoute(url: URL, page: AppRoute) {
    const { matches, redirect } = await loadStaticRoute(
      app,
      url,
      page,
      fetcher,
      routeChunkLoader,
    );

    if (redirect) {
      const pathname = $.normalizeURL(url).pathname;
      build.staticRedirects.set(pathname, {
        from: pathname,
        to: redirect.path,
        filename: $.resolveHTMLFilename(url),
        html: $.createRedirectMetaTag(redirect.path),
        status: redirect.status,
      });
    }

    const dataMap = createStaticLoaderDataMap(matches);
    for (const id of dataMap.keys()) {
      const content = dataMap.get(id)!;
      if (Object.keys(content).length > 0) {
        const serializedContent = JSON.stringify(content);
        const contentHash = $.hash(serializedContent);
        build.staticData.set(id, {
          data: content,
          idHash: $.hash(id),
          contentHash,
          filename: $.resolveDataFilename(contentHash),
          serializedData: JSON.stringify(content),
        });
      }
    }

    return { redirect, matches, dataMap };
  }

  // -------------------------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------------------------

  const serverEntryPath = app.dirs.server.resolve('entry.js');
  const validPathname = /(\/|\.html)$/;

  const { render } = (await import(serverEntryPath)) as ServerEntryModule;

  async function buildPage(url: URL, pageRoute: AppRoute) {
    const normalizedURL = $.normalizeURL(url);
    const pathname = normalizedURL.pathname;

    if (build.links.has(pathname) || build.badLinks.has(pathname)) {
      return;
    }

    if (!validPathname.test(pathname)) {
      build.badLinks.set(pathname, {
        route: pageRoute,
        reason: 'malformed URL pathname',
      });
      return;
    }

    const { redirect, matches, dataMap } = await loadRoute(
      normalizedURL,
      pageRoute,
    );

    // Redirect.
    if (redirect) {
      const location = redirect.path;
      await onFoundLink(pageRoute, location);
      return;
    }

    // Pages that are dynamically rendered on the server (i.e., has `serverLoader` in branch).
    if (!build.staticPages.has(pageRoute)) return;

    const result = {
      filename: $.resolveHTMLFilename(url),
      route: pageRoute,
      matches,
      ssr: await render({
        route: matches[matches.length - 1],
        matches,
        router: serverRouter,
      }),
      dataAssetIds: new Set(dataMap.keys()),
    };

    build.links.set(pathname, pageRoute);
    build.staticRenders.set(pathname, result);

    const hrefs = $.crawl(result.ssr.html);
    for (let i = 0; i < hrefs.length; i++) {
      await onFoundLink(pageRoute, hrefs[i]);
    }
  }

  async function onFoundLink(pageRoute: AppRoute, href: string) {
    if (href.startsWith('#') || $.isLinkExternal(href)) return;

    const url = new URL(`${ssrOrigin}${$.slash(href)}`);
    const pathname = $.normalizeURL(url).pathname;

    if (build.links.has(pathname) || build.badLinks.has(pathname)) return;

    const route = findRoute(url, pageRoutes);
    if (route) {
      await buildPage(url, route);
      return;
    }

    build.badLinks.set(pathname, {
      route: pageRoute,
      reason: 'no matching route (404)',
    });
  }

  // Start with static page paths and then crawl additional links.
  for (const route of pageRoutes.filter((route) => !route.dynamic).reverse()) {
    await buildPage(
      new URL(`${ssrOrigin}${cleanRoutePath(route.pattern.pathname)}`),
      route,
    );
  }

  await adapter.startRenderingPages?.();

  for (const entry of app.config.routes.entries) {
    const url = new URL(`${ssrOrigin}${$.slash(entry)}`);
    const route = findRoute(url, pageRoutes);
    if (route) {
      await buildPage(url, route);
    } else {
      build.badLinks.set(entry, {
        reason: 'no matching route (404)',
      });
    }
  }

  await adapter.finishRenderingPages?.();
  await adapter.write?.();
  await adapter.close?.();
}

function collectChunks(bundle: OutputBundle) {
  const chunks: OutputChunk[] = [];

  for (const value of Object.values(bundle)) {
    if (value.type === 'chunk') {
      chunks.push(value);
    }
  }

  return chunks;
}

function collectOutput(bundle: OutputBundle) {
  const chunks: OutputChunk[] = [];
  const assets: OutputAsset[] = [];

  for (const value of Object.values(bundle)) {
    if (value.type === 'asset') {
      assets.push(value);
    } else {
      chunks.push(value);
    }
  }

  return { chunks, assets };
}

export type BuildBundles = {
  entries: Record<string, string>;
  client: {
    output: OutputBundle;
    entryChunk: OutputChunk;
    appChunk: OutputChunk;
    appCSSAsset?: OutputAsset;
    chunks: OutputChunk[];
    assets: OutputAsset[];
    /**
     * Vite manifest that can be used to build preload/prefetch directives. The manifest contains
     * mappings of module IDs to their associated chunks and asset files.
     *
     * @see {@link https://vitejs.dev/guide/ssr.html#generating-preload-directives}
     */
    viteManifest: ViteManifest;
  };
  server: {
    output: OutputBundle;
    chunks: OutputChunk[];
  };
};

export type BuildData = {
  /**
   * Application entry files that are passed to Rollup's `input` option.
   */
  entries: Record<string, string>;
  /**
   * Valid links and their respective routes that were found during the static build process.
   */
  links: Map<string, AppRoute>;
  /**
   * Map of invalid links that were either malformed or matched no route pattern during
   * the static build process. The key contains the bad URL pathname.
   */
  badLinks: Map<string, { route?: AppRoute; reason: string }>;
  /**
   * Page routes that are static meaning they contain no `serverLoader` in their branch (page
   * itself or any of its layouts).
   */
  staticPages: Set<AppRoute>;
  /**
   * Redirects returned from `staticLoader` calls. The object keys are the URL pathname being
   * redirected from.
   */
  staticRedirects: Map<
    string,
    {
      /** The URL pathname being redirected from. */
      from: string;
      /** The URL pathname being redirected to. */
      to: string;
      /** The redirect HTML file name which can be used to output file relative to build directory. */
      filename: string;
      /** The HTML file content containing the redirect meta tag. */
      html: string;
      /** HTTP status code used for the redirect. */
      status: number;
    }
  >;
  /**
   * Map of links (URL pathname) and their respective SSR rendered content and loaded data asset
   * IDs.
   */
  staticRenders: Map<
    string,
    {
      /** The HTML file name which can be used to output file relative to build directory. */
      filename: string;
      /** The matching page route. */
      route: AppRoute;
      /** The loaded server routes. */
      matches: ServerLoadedRoute[];
      /** The SSR results containing head, css, and HTML renders. */
      ssr: ServerRenderResult;
      /**
       * All static data asset ID's that belong to this path. These can be used find matching
       * records in the `staticData` object.
       */
      dataAssetIds: Set<string>;
    }
  >;
  /**
   * Static JSON data that has been loaded by pages and layouts. The key is a unique data asset ID
   * for the given route and URL path combination. You can find data ID's in the `renders` map
   * for each page.
   */
  staticData: Map<
    string,
    {
      /** The data JSON file name which can be used to output file relative to build directory. */
      filename: string;
      /** Loaded data. */
      data: Record<string, unknown>;
      /** The loaded data serailized (JSON.stringify). */
      serializedData: string;
      /** The data asset ID sha-1 hash. */
      idHash: string;
      /** The serialized content sha-1 hash. */
      contentHash: string;
    }
  >;
  /**
   * Route ids and their respective chunks.
   */
  routeChunks: Map<string, { [P in RouteFileType]?: OutputChunk }>;
  /**
   * Route ids and their respective chunk file paths (absolute).
   */
  routeChunkFile: Map<string, { [P in RouteFileType]?: string }>;
  /**
   * File routes (pages/layouts) that contain a `staticLoader` export.
   */
  staticLoaderRoutes: Set<AppRoute>;
  /**
   * File routes (pages/layouts) that contain a `serverLoader` export. These routes should be
   * dynamically rendered on the server.
   */
  serverLoaderRoutes: Set<AppRoute>;
  /**
   * Page routes that are dynamic meaning they contain a `serverLoader` in their branch (page
   * itself or any of its layouts). These pages are dynamically rendered on the server.
   */
  serverPages: Set<AppRoute>;
  /**
   * Server endpoints that are used server-side to respond to HTTP requests.
   */
  serverHttpEndpoints: Set<AppRoute>;
};
