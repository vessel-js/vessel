import kleur from 'kleur';
import type { App } from 'node/app/App';
import { createAppEntries } from 'node/app/create/app-factory';
import { getRouteFileTypes, type RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import { hash, logger, LoggerIcon, mkdirp, rimraf } from 'node/utils';
import { createStaticLoaderFetcher, loadStaticRoute } from 'node/vite/core';
import { getDevServerOrigin } from 'node/vite/core/dev-server';
import fs from 'node:fs';
import { writeFile } from 'node:fs/promises';
import ora from 'ora';
import type { OutputBundle } from 'rollup';
import { createServerRouter } from 'server/http';
import { installPolyfills } from 'server/polyfills';
import { createStaticLoaderDataMap } from 'server/static-data';
import type { ServerEntryModule } from 'server/types';
import {
  cleanRoutePath,
  findRoute,
  getRouteComponentTypes,
  normalizeURL as __normalizeURL,
} from 'shared/routing';
import { isFunction } from 'shared/utils/unit';
import { isLinkExternal, slash } from 'shared/utils/url';
import type { Manifest as ViteManifest } from 'vite';

import { createAutoBuildAdapter } from './adapter';
import type { BuildBundles, BuildData } from './build-data';
import {
  createRedirectMetaTag,
  findPreviewScriptName,
  guessPackageManager,
  pluralize,
  resolveDataFilename,
  resolveHTMLFilename,
} from './build-utils';
import {
  resolveChunks,
  resolveChunksAndAssets,
  resolveServerRoutes,
} from './chunks';
import { crawl } from './crawl';
import { logBadLinks, logRoutes } from './log';
import { buildServerManifests } from './manifest';
import { resolveDocumentResourcesFromManifest } from './resources';

export async function build(
  app: App,
  clientBundle: OutputBundle,
  serverBundle: OutputBundle,
): Promise<void> {
  const pageRoutes = app.routes.filterHasType('page');
  const httpRoutes = app.routes.filterHasType('http');

  if (pageRoutes.length === 0) {
    console.log(kleur.bold(`❓ No pages were resolved`));
    return;
  }

  await installPolyfills();

  const startTime = Date.now();
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

  const serverRouteChunks: BuildData['server']['chunks'] = new Map();
  const serverRouteChunkFiles: BuildData['server']['chunkFiles'] = new Map();

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

    serverRouteChunks.set(route.id, chunks);
    serverRouteChunkFiles.set(route.id, files);
  }

  const { edgeRoutes, serverLoaders } = resolveServerRoutes(
    app,
    serverRouteChunks,
  );

  const build: BuildData = {
    entries,
    template,
    links: new Map(),
    badLinks: new Map(),
    static: {
      pages: new Set(),
      redirects: new Map(),
      renders: new Map(),
      data: new Map(),
      routeData: new Map(),
      clientHashRecord: {},
      serverHashRecord: {},
    },
    server: {
      routes: new Set(),
      endpoints: new Set(httpRoutes),
      chunks: serverRouteChunks,
      chunkFiles: serverRouteChunkFiles,
      loaders: serverLoaders,
    },
    edge: {
      routes: edgeRoutes,
    },
    resources: resolveDocumentResourcesFromManifest(app, bundles),
  };

  // Determine which pages are static and which are dynamically rendered on the server.
  for (const route of pageRoutes) {
    if (build.server.loaders.has(route.id)) {
      build.server.routes.add(route);
    } else {
      build.static.pages.add(route);
    }
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
    (route) => import(serverRouteChunkFiles.get(route.id)!.http!),
  );

  const routeChunkLoader = (route: AppRoute, type: RouteFileType) =>
    import(serverRouteChunkFiles.get(route.id)![type]!);

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
      build.static.redirects.set(pathname, {
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
        const idHash = hash(id);
        const contentHash = hash(serializedContent);

        build.static.data.set(id, {
          data: content,
          idHash,
          contentHash,
          filename: resolveDataFilename(contentHash),
          serializedData: JSON.stringify(content),
        });

        build.static.clientHashRecord[idHash] = contentHash;
        build.static.serverHashRecord[id] = idHash;
      }
    }

    if (build.static.routeData.has(page.id)) {
      const set = build.static.routeData.get(page.id)!;
      for (const id of dataMap.keys()) set.add(id);
    } else {
      build.static.routeData.set(page.id, new Set(dataMap.keys()));
    }

    return { redirect, matches, dataMap };
  }

  // -------------------------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------------------------

  console.log(kleur.magenta('+ build\n'));

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
    if (!build.static.pages.has(pageRoute)) return;

    const ssr = await render({
      route: matches[matches.length - 1],
      matches,
      router: ssrRouter,
    });

    build.links.set(pathname, pageRoute);

    build.static.renders.set(pathname, {
      filename: resolveHTMLFilename(url),
      route: pageRoute,
      matches,
      ssr,
      data: new Set(dataMap.keys()),
    });

    const hrefs = crawl(ssr.html);
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

  const renderingSpinner = ora();
  const staticPagesCount = build.static.pages.size;

  renderingSpinner.start(
    kleur.bold(
      `Rendering ${kleur.underline(staticPagesCount)} ${pluralize(
        'static HTML page',
        staticPagesCount,
      )}...`,
    ),
  );

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

  renderingSpinner.stopAndPersist({
    symbol: LoggerIcon.Success,
    text: kleur.bold(
      `Rendered ${kleur.underline(staticPagesCount)} ${pluralize(
        'static HTML page',
        staticPagesCount,
      )}`,
    ),
  });

  // -------------------------------------------------------------------------------------------
  // SERVER MANIFEST
  // -------------------------------------------------------------------------------------------

  const serverManifests = buildServerManifests(app, bundles, build);

  if (serverManifests) {
    const { dataAssets, ...manifests } = serverManifests;

    if (dataAssets.size > 0) {
      const seen = new Set<string>();

      const dataSpinner = logger.withSpinner('Writing server data files...', {
        successTitle: () =>
          `Committed ${kleur.underline(seen.size)} server data files`,
      });

      const dataDir = app.dirs.server.resolve('_data');
      mkdirp(dataDir);

      await dataSpinner(async () => {
        await Promise.all(
          Array.from(dataAssets).map(async (id) => {
            const data = build.static.data.get(id)!;
            if (!seen.has(data.contentHash)) {
              await writeFile(
                dataDir + `/${data.contentHash}.js`,
                `export const data = ${data.serializedData};`,
              );
              seen.add(data.contentHash);
            }
          }),
        );
      });
    }

    const manifestNames = Object.keys(manifests).filter((k) => manifests[k]);
    const manifestCount = kleur.underline(manifestNames.length);

    const manifestSpinner = logger.withSpinner('Writing server manifests...', {
      successTitle: `Committed ${manifestCount} server manifests`,
    });

    const manifestsDir = app.dirs.server.resolve('_manifests');
    mkdirp(manifestsDir);

    await manifestSpinner(async () => {
      await Promise.all(
        manifestNames.map(async (name) => {
          app.dirs.server.write(`${manifestsDir}/${name}.js`, manifests[name]!);
        }),
      );
    });
  }

  // Insert which nodes can fetch from the server into the client app bundle. Order here is
  // important. It should match how the client manifest is loaded in `files-plugin.ts`.
  if (build.server.loaders.size > 0) {
    const canFetch: number[] = [];
    const serverLoaders = build.server.loaders;

    let loaderIndex = 0;
    for (const route of app.routes.toArray()) {
      const loaders = serverLoaders.get(route.id);
      for (const type of getRouteComponentTypes()) {
        if (route[type]) {
          loaderIndex++;
          if (loaders?.[type]) canFetch.push(loaderIndex);
        }
      }
    }

    const content = app.dirs.client.read(appFileName);
    app.dirs.client.write(
      appFileName,
      content.replace('"__VSL_SERVER_FETCH__"', `[${canFetch.join(',')}]`),
    );
  }

  await adapter.write?.();

  // -------------------------------------------------------------------------------------------
  // CLOSE
  // -------------------------------------------------------------------------------------------

  logBadLinks(build.badLinks);
  logRoutes(app, build, bundles);

  const icons = {
    10: '🤯',
    20: '🏎️',
    30: '🏃',
    40: '🐌',
    Infinity: '⚰️',
  };

  const endTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const formattedEndTime = kleur.underline(endTime);
  const icon = icons[Object.keys(icons).find((t) => endTime <= t)!];

  logger.success(kleur.bold(`Build complete in ${formattedEndTime} ${icon}`));

  const pkgManager = await guessPackageManager(app);
  const previewCommand = await findPreviewScriptName(app);

  console.log(
    kleur.bold(
      `⚡ ${
        previewCommand
          ? `Run \`${
              pkgManager === 'npm' ? 'npm run' : pkgManager
            } ${previewCommand}\` to serve production build`
          : 'Ready for preview'
      }\n`,
    ),
  );
}
