import kleur from 'kleur';
import type { App } from 'node/app/App';
import { createAppEntries } from 'node/app/create/app-factory';
import { getRouteFileTypes, type RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import { hash, rimraf } from 'node/utils';
import { createStaticLoaderFetcher, loadStaticRoute } from 'node/vite/core';
import { getDevServerOrigin } from 'node/vite/core/dev/server';
import fs from 'node:fs';
import type { OutputBundle } from 'rollup';
import { createStaticLoaderDataMap } from 'server';
import { createServerRouter } from 'server/http';
import { installPolyfills } from 'server/polyfills';
import type { ServerEntryModule } from 'server/types';
import {
  cleanRoutePath,
  findRoute,
  normalizeURL as __normalizeURL,
} from 'shared/routing';
import { isFunction } from 'shared/utils/unit';
import { isLinkExternal, slash } from 'shared/utils/url';
import type { Manifest as ViteManifest } from 'vite';

import { createAutoBuildAdapter } from './adapter';
import type { BuildBundles, BuildData } from './build-data';
import {
  createRedirectMetaTag,
  resolveDataFilename,
  resolveHTMLFilename,
} from './build-utils';
import {
  resolveChunks,
  resolveChunksAndAssets,
  resolveRoutesLoaderInfo,
} from './chunks';
import { crawl } from './crawl';
import { resolveDocumentResourcesFromManifest } from './resources';

export async function build(
  app: App,
  clientBundle: OutputBundle,
  serverBundle: OutputBundle,
): Promise<void> {
  const pageRoutes = app.routes.filterByType('page');
  const httpRoutes = app.routes.filterByType('http');

  if (pageRoutes.length === 0) {
    console.log(kleur.bold(`❓ No pages were resolved`));
    return;
  }

  await installPolyfills();

  const entries = createAppEntries(app, { isSSR: true });

  const template = await fs.readFileSync(
    app.dirs.client.resolve('app/index.html'),
    'utf-8',
  );

  rimraf(app.dirs.client.resolve('app'));

  const viteManifestPath = app.dirs.client.resolve('vite-manifest.json');
  const clientManifest = JSON.parse(
    await fs.promises.readFile(viteManifestPath, 'utf-8'),
  ) as ViteManifest;

  // Client/server chunks and assets
  const { chunks: clientChunks, assets: clientAssets } =
    resolveChunksAndAssets(clientBundle);
  const serverChunks = resolveChunks(serverBundle);

  // Entry client/server chunks
  const entryRootPath = app.dirs.root.relative(app.config.entry.client);
  const entryFileName = clientManifest[entryRootPath].file;
  const entryChunk = clientChunks.find(
    (chunk) => chunk.isEntry && chunk.fileName === entryFileName,
  )!;
  const serverEntryPath = app.dirs.server.resolve('entry.js');
  const serverEntryChunk = serverChunks.find(
    (chunk) => chunk.isEntry && chunk.fileName === 'entry.js',
  )!;

  // App client/server chunks
  const appRootPath = app.dirs.root.relative(app.config.client.app);
  const appFileName = clientManifest[appRootPath].file;
  const appManifestChunk = clientManifest[appRootPath];
  const serverAppChunk = serverChunks.find(
    (chunk) => chunk.isEntry && chunk.fileName === 'app.js',
  )!;

  const bundles: BuildBundles = {
    entries,
    client: {
      bundle: clientBundle,
      chunks: clientChunks,
      assets: clientAssets,
      manifest: clientManifest,
      entry: { chunk: entryChunk },
      app: {
        chunk: clientChunks.find(
          (chunk) => chunk.isEntry && chunk.fileName === appFileName,
        )!,
        css: (appManifestChunk.css ?? []).map(
          (file) => clientAssets.find((asset) => asset.fileName === file)!,
        ),
        assets: (appManifestChunk.assets ?? []).map(
          (file) => clientAssets.find((asset) => asset.fileName === file)!,
        ),
      },
    },
    server: {
      bundle: serverBundle,
      chunks: serverChunks,
      entry: { chunk: serverEntryChunk },
      app: { chunk: serverAppChunk },
    },
  };

  const build: BuildData = {
    entries,
    template,
    links: new Map(),
    badLinks: new Map(),
    staticPages: new Set(),
    staticData: new Map(),
    staticRedirects: new Map(),
    staticRenders: new Map(),
    serverPages: new Set(),
    serverEndpoints: new Set(httpRoutes),
    routeChunks: new Map(),
    routeChunkFile: new Map(),
    resources: resolveDocumentResourcesFromManifest(app, bundles),
    ...resolveRoutesLoaderInfo(app, bundles),
  };

  // Determine which pages are static and which are dynamically rendered on the server.
  for (const pageRoute of pageRoutes) {
    if (build.serverRoutes.has(pageRoute)) {
      build.serverPages.add(pageRoute);
    } else {
      build.staticPages.add(pageRoute);
    }
  }

  // Resolve route chunks.
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

  const adapterFactory = isFunction(app.config.build.adapter)
    ? app.config.build.adapter
    : createAutoBuildAdapter(app.config.build.adapter);

  const adapter = await adapterFactory(app, bundles, build);

  // -------------------------------------------------------------------------------------------
  // LOAD STATIC DATA
  // -------------------------------------------------------------------------------------------

  const trailingSlashes = app.config.routes.trailingSlash;
  const normalizeURL = (url: URL) => __normalizeURL(url, trailingSlashes);

  const ssrOrigin = getDevServerOrigin(app);
  const ssrRouter = createServerRouter();

  const fetcher = createStaticLoaderFetcher(
    app,
    (route) => import(build.routeChunkFile.get(route.id)!.http!),
  );

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
      const pathname = normalizeURL(url).pathname;
      build.staticRedirects.set(pathname, {
        from: pathname,
        to: redirect.path,
        filename: resolveHTMLFilename(url),
        html: createRedirectMetaTag(redirect.path),
        status: redirect.status,
      });
    }

    const dataMap = createStaticLoaderDataMap(matches);
    for (const id of dataMap.keys()) {
      const content = dataMap.get(id)!;
      if (Object.keys(content).length > 0) {
        const serializedContent = JSON.stringify(content);
        const contentHash = hash(serializedContent);
        build.staticData.set(id, {
          data: content,
          idHash: hash(id),
          contentHash,
          filename: resolveDataFilename(contentHash),
          serializedData: JSON.stringify(content),
        });
      }
    }

    return { redirect, matches, dataMap };
  }

  // -------------------------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------------------------

  const testTrailingSlash = (pathname: string) =>
    pathname === '/' || trailingSlashes
      ? /\/$/.test(pathname)
      : !/\/$/.test(pathname);

  const { render } = (await import(serverEntryPath)) as ServerEntryModule;

  async function buildPage(url: URL, pageRoute: AppRoute) {
    const normalizedURL = normalizeURL(url);
    const pathname = normalizedURL.pathname;

    if (build.links.has(pathname) || build.badLinks.has(pathname)) {
      return;
    }

    if (!testTrailingSlash(pathname)) {
      build.badLinks.set(pathname, {
        route: pageRoute,
        reason: `should ${trailingSlashes ? '' : 'not'} have trailing slash`,
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
      filename: resolveHTMLFilename(url),
      route: pageRoute,
      matches,
      ssr: await render({
        route: matches[matches.length - 1],
        matches,
        router: ssrRouter,
      }),
      dataAssetIds: new Set(dataMap.keys()),
    };

    build.links.set(pathname, pageRoute);
    build.staticRenders.set(pathname, result);

    const hrefs = crawl(result.ssr.html);
    for (let i = 0; i < hrefs.length; i++) {
      await onFoundLink(pageRoute, hrefs[i]);
    }
  }

  async function onFoundLink(pageRoute: AppRoute, href: string) {
    if (href.startsWith('#') || isLinkExternal(href)) return;

    const url = new URL(`${ssrOrigin}${slash(href)}`);
    const pathname = normalizeURL(url).pathname;

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
    const url = new URL(`${ssrOrigin}${slash(entry)}`);
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
