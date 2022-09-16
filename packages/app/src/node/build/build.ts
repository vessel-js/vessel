import kleur from 'kleur';
import type { App } from 'node/app/App';
import { createAppEntries } from 'node/app/create/app-factory';
import {
  type EndpointFileRoute,
  type PageFileRoute,
  resolvePageSegments,
  type SystemFileRoute,
} from 'node/app/routes';
import { loadStaticRoute } from 'node/vite/core';
import fs from 'node:fs';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import { createStaticDataMap } from 'server';
import { createEndpointHandler, handleHttpError, httpError } from 'server/http';
import { installPolyfills } from 'server/polyfills';
import type {
  LoadedServerRoute,
  ServerEntryModule,
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
  if (app.routes.pages.size === 0) {
    console.log(kleur.bold(`❓ No pages were resolved`));
    return;
  }

  await installPolyfills();

  const ssrProtocol = app.vite.resolved!.server.https ? 'https' : 'http';
  const ssrOrigin = `${ssrProtocol}://localhost`;

  const pageRoutes = app.routes.pages.toArray();
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

  const build: BuildData = {
    entries,
    links: new Map(),
    badLinks: new Map(),
    staticPages: new Set(),
    staticData: new Map(),
    staticRedirects: new Map(),
    staticRenders: new Map(),
    serverPages: new Set(),
    serverEndpoints: new Set(app.routes.endpoints),
    routeChunks: new Map(),
    routeChunkFile: new Map(),
    ...resolveLoaderChunks(app, bundles.server),
  };

  // staticPages + serverPages
  for (const page of app.routes.pages) {
    const segments = resolvePageSegments(app, page);
    if (segments.some((route) => build.serverLoaderRoutes.has(route))) {
      build.serverPages.add(page);
    } else {
      build.staticPages.add(page);
    }
  }

  for (const route of app.routes.all) {
    const chunk = bundles.server.chunks.find(
      (chunk) => chunk.facadeModuleId === route.file.path,
    );
    if (chunk) {
      build.routeChunks.set(route.id, chunk);
      build.routeChunkFile.set(
        route.id,
        app.dirs.server.resolve(chunk.fileName),
      );
    }
  }

  const $ = getBuildAdapterUtils(app, bundles, build);

  const adapterFactory = isFunction(app.config.build.adapter)
    ? app.config.build.adapter
    : createAutoBuildAdapter(app.config.build.adapter);

  const adapter = await adapterFactory(app, bundles, build, $);

  // -------------------------------------------------------------------------------------------
  // LOAD DATA
  // -------------------------------------------------------------------------------------------

  const fetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    if (typeof input === 'string' && app.routes.endpoints.test(input)) {
      const url = new URL(`${ssrOrigin}${input}`);
      const route = findRoute(url, app.routes.endpoints.toArray());

      if (!route) {
        return Promise.resolve(handleHttpError(httpError('not found', 404)));
      }

      const handler = createEndpointHandler({
        pattern: route.pattern,
        getClientAddress: () => {
          throw new Error('Can not resolve `clientAddress` during SSR');
        },
        loader: () => import(build.routeChunkFile.get(route.id)!),
      });

      return handler(new Request(url, init));
    }

    return fetch(input, init);
  };

  const routeLoader = (route: SystemFileRoute) =>
    import(build.routeChunkFile.get(route.id)!);

  const canLoadStaticData = (route: SystemFileRoute) =>
    build.staticLoaderRoutes.has(route);

  async function loadRoute(url: URL, page: PageFileRoute) {
    const { route, redirect } = await loadStaticRoute(
      app,
      url,
      page,
      routeLoader,
      canLoadStaticData,
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

    const dataMap = createStaticDataMap(route);
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

    return { redirect, route, dataMap };
  }

  // -------------------------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------------------------

  const serverEntryPath = app.dirs.server.resolve('entry.js');
  const validPathname = /(\/|\.html)$/;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { render } = (await import(serverEntryPath)) as ServerEntryModule;

  // eslint-disable-next-line no-inner-declarations
  async function buildPage(url: URL, page: PageFileRoute) {
    const normalizedURL = $.normalizeURL(url);
    const pathname = normalizedURL.pathname;

    if (build.links.has(pathname) || build.badLinks.has(pathname)) {
      return;
    }

    if (!validPathname.test(pathname)) {
      build.badLinks.set(pathname, {
        page,
        reason: 'malformed URL pathname',
      });
      return;
    }

    const { redirect, route, dataMap } = await loadRoute(normalizedURL, page);

    // Redirect.
    if (redirect) {
      const location = redirect.path;
      await onFoundLink(page, location);
      return;
    }

    // Pages that are dynamically rendered on the server (i.e., has `serverLoader` in branch).
    if (!build.staticPages.has(page)) return;

    const result = {
      filename: $.resolveHTMLFilename(url),
      page,
      route,
      ssr: await render({ route }),
      dataAssetIds: new Set(dataMap.keys()),
    };

    build.links.set(pathname, page);
    build.staticRenders.set(pathname, result);

    const hrefs = $.crawl(result.ssr.html);
    for (let i = 0; i < hrefs.length; i++) {
      await onFoundLink(page, hrefs[i]);
    }
  }

  async function onFoundLink(page: PageFileRoute, href: string) {
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
      page,
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
    const page = findRoute(url, pageRoutes);

    if (page) {
      await buildPage(url, page);
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
  links: Map<string, PageFileRoute>;
  /**
   * Map of invalid links that were either malformed or matched no route pattern during
   * the static build process. The key contains the bad URL pathname.
   */
  badLinks: Map<string, { page?: PageFileRoute; reason: string }>;
  /**
   * Page routes that are static meaning they contain no `serverLoader` in their branch (page
   * itself or any of its layouts).
   */
  staticPages: Set<PageFileRoute>;
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
      /** The matching page file route. */
      page: PageFileRoute;
      /** The loaded server route. */
      route: LoadedServerRoute;
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
  routeChunks: Map<string, OutputChunk>;
  /**
   * Route ids and their respective chunk file path (absolute).
   */
  routeChunkFile: Map<string, string>;
  /**
   * File routes (pages/layouts) that contain a `staticLoader` export.
   */
  staticLoaderRoutes: Set<SystemFileRoute>;
  /**
   * File routes (pages/layouts) that contain a `serverLoader` export. These routes should be
   * dynamically rendered on the server.
   */
  serverLoaderRoutes: Set<SystemFileRoute>;
  /**
   * Page routes that are dynamic meaning they contain a `serverLoader` in their branch (page
   * itself or any of its layouts). These pages are dynamically rendered on the server.
   */
  serverPages: Set<PageFileRoute>;
  /**
   * Server endpoints that are used server-side to respond to HTTP requests.
   */
  serverEndpoints: Set<EndpointFileRoute>;
};
