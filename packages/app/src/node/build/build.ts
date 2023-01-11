import fs from 'node:fs';
import { writeFile } from 'node:fs/promises';

import kleur from 'kleur';
import ora from 'ora';
import type { OutputBundle } from 'rollup';
import type { Manifest as ViteManifest } from 'vite';

import type { App } from 'node/app/App';
import { createAppEntries } from 'node/app/create/app-factory';
import type { RouteFileType } from 'node/app/files';
import { AppRoute, toRoute } from 'node/app/routes';
import { installPolyfills } from 'node/polyfills';
import { hash, logger, LoggerIcon, mkdirp, rimraf } from 'node/utils';
import { createStaticLoaderFetch, loadStaticRoute } from 'node/vite/core';
import { getDevServerOrigin } from 'node/vite/core/dev-server';
import { createServerRouter } from 'server/http';
import { installServerConfigs, ServerConfig } from 'server/http/app/configure-server';
import { createStaticLoaderDataMap } from 'server/static-data';
import type { ServerEntryModule, ServerManifest } from 'server/types';
import {
  normalizeURL as __normalizeURL,
  cleanRoutePath,
  findRoute,
  getRouteComponentTypes,
} from 'shared/routing';
import { isFunction } from 'shared/utils/unit';
import { isLinkExternal, slash } from 'shared/utils/url';

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
  resolveAppChunkInfo,
  resolveChunks,
  resolveChunksAndAssets,
  resolveEntryChunkInfo,
  resolveServerConfigChunks,
  resolveServerRouteChunks,
  resolveServerRoutes,
} from './chunks';
import { crawl } from './crawl';
import { logBadLinks, logRoutes } from './log';
import { buildServerManifests } from './manifest';
import { resolveDocumentResourcesFromManifest } from './resources';
import { resolveAllRoutes } from './routes';

export async function build(
  app: App,
  clientBundle: OutputBundle,
  serverBundle: OutputBundle,
): Promise<void> {
  const pageRoutes = app.routes.filterHasType('page');
  const apiRoutes = app.routes.filterHasType('api');

  if (pageRoutes.length === 0) {
    console.log(kleur.bold(`❓ No pages were resolved`));
    return;
  }

  await installPolyfills();

  const startTime = Date.now();
  const entries = createAppEntries(app, { isSSR: true });

  const template = await fs.readFileSync(app.dirs.vessel.client.resolve('app/app.html'), 'utf-8');

  rimraf(app.dirs.vessel.client.resolve('app'));

  const viteManifestPath = app.dirs.vessel.client.resolve('vite-manifest.json');
  const clientManifest = JSON.parse(
    await fs.promises.readFile(viteManifestPath, 'utf-8'),
  ) as ViteManifest;

  const { chunks: clientChunks, assets: clientAssets } = resolveChunksAndAssets(clientBundle);
  const serverChunks = resolveChunks(serverBundle);
  const entryChunkInfo = resolveEntryChunkInfo(app, clientManifest, clientChunks, serverChunks);
  const appChunkInfo = resolveAppChunkInfo(app, clientManifest, clientChunks, serverChunks);
  const serverConfigChunks = resolveServerConfigChunks(app, serverChunks);
  const { serverRouteChunks, serverRouteChunkFiles } = resolveServerRouteChunks(app, serverChunks);

  const bundles: BuildBundles = {
    entries,
    client: {
      bundle: clientBundle,
      chunks: clientChunks,
      assets: clientAssets,
      manifest: clientManifest,
      entry: { chunk: entryChunkInfo.client.chunk },
      app: {
        chunk: appChunkInfo.client.chunk,
        css: (appChunkInfo.vite.chunk.css ?? []).map(
          (file) => clientAssets.find((asset) => asset.fileName === file)!,
        ),
        assets: (appChunkInfo.vite.chunk.assets ?? []).map(
          (file) => clientAssets.find((asset) => asset.fileName === file)!,
        ),
      },
    },
    server: {
      bundle: serverBundle,
      chunks: serverChunks,
      entry: { chunk: entryChunkInfo.server.chunk },
      app: { chunk: appChunkInfo.server.chunk },
      configs: serverConfigChunks,
      routes: {
        chunks: serverRouteChunks,
        files: serverRouteChunkFiles,
      },
    },
  };

  const serverChunkInfo = resolveServerRoutes(app, serverRouteChunks);

  const serverConfigs: Record<string, ServerConfig> = {};
  await Promise.all(
    Object.keys(serverConfigChunks).map(async (key) => {
      serverConfigs[key] = (
        await import(app.dirs.vessel.server.resolve(serverConfigChunks[key].fileName))
      ).default;
    }),
  );

  const build: BuildData = {
    entries,
    bundles,
    template,
    links: new Map(),
    badLinks: new Map(),
    routes: {
      pages: new Map(),
      api: new Map(),
    },
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
      pages: new Set(),
      api: new Set(apiRoutes),
      loaders: serverChunkInfo.serverLoaders,
      configs: serverConfigs,
    },
    edge: {
      routes: serverChunkInfo.edgeRoutes,
    },
    resources: resolveDocumentResourcesFromManifest(app, bundles),
  };

  // Determine which pages are static and which are dynamically rendered on the server.
  for (const route of pageRoutes) {
    if (build.server.loaders.has(route.id)) {
      build.server.pages.add(route);
    } else {
      build.static.pages.add(route);
    }
  }

  const adapterFactory = isFunction(app.config.build.adapter)
    ? app.config.build.adapter
    : createAutoBuildAdapter(app.config.build.adapter);

  const adapter = await adapterFactory(app, build);

  // -------------------------------------------------------------------------------------------
  // LOAD STATIC DATA
  // -------------------------------------------------------------------------------------------

  const hasTrailingSlash = app.config.routes.trailingSlash;
  const normalizeURL = (url: URL) => __normalizeURL(url, hasTrailingSlash);

  const serverOrigin = getDevServerOrigin(app);
  const serverRouter = createServerRouter();

  const serverManifest: ServerManifest = {
    production: false,
    baseUrl: app.vite.resolved!.base,
    trailingSlash: app.config.routes.trailingSlash,
    entry: () => import(entryChunkInfo.server.path),
    configs: Object.values(serverConfigs),
    routes: {
      pages: [], // don't need it here.
      api: app.routes.filterHasType('api').map((route) => ({
        ...toRoute(route),
        loader: () => import(serverRouteChunkFiles.get(route.id)!.api!),
      })),
    },
    document: {
      entry: `/${bundles.server.entry.chunk.fileName}`,
      template: build.template,
    },
    staticData: {},
  };

  installServerConfigs(serverManifest);

  const serverFetch = createStaticLoaderFetch(app, serverManifest);

  const routeChunkLoader = (route: AppRoute, type: RouteFileType) =>
    import(serverRouteChunkFiles.get(route.id)![type]!);

  async function loadRoute(url: URL, page: AppRoute) {
    const { matches, redirect } = await loadStaticRoute(
      app,
      url,
      page,
      serverFetch,
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
    pathname === '/' || hasTrailingSlash ? /\/$/.test(pathname) : !/\/$/.test(pathname);

  const { render } = (await import(entryChunkInfo.server.path)) as ServerEntryModule;

  async function buildPage(url: URL, pageRoute: AppRoute) {
    const normalizedURL = normalizeURL(url);
    const pathname = normalizedURL.pathname;

    if (build.links.has(pathname) || build.badLinks.has(pathname)) {
      return;
    }

    if (!testTrailingSlash(pathname)) {
      build.badLinks.set(pathname, {
        route: pageRoute,
        reason: `should ${hasTrailingSlash ? '' : 'not'} have trailing slash`,
      });
      return;
    }

    const { redirect, matches, dataMap } = await loadRoute(normalizedURL, pageRoute);

    // Redirect.
    if (redirect) {
      const location = redirect.path;
      await onFoundLink(pageRoute, location);
      return;
    }

    if (!build.static.pages.has(pageRoute)) return;

    const ssr = await render({
      route: matches[matches.length - 1],
      matches,
      router: serverRouter,
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

    const url = new URL(`${serverOrigin}${slash(href)}`);
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
    await buildPage(new URL(`${serverOrigin}${cleanRoutePath(route.pattern.pathname)}`), route);
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
    const url = new URL(`${serverOrigin}${slash(entry)}`);
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

  const serverManifestOutputs = buildServerManifests(app, build);

  if (serverManifestOutputs.edge || serverManifestOutputs.node) {
    const { dataAssets, ...manifests } = serverManifestOutputs;

    if (dataAssets.size > 0) {
      const seen = new Set<string>();

      const dataSpinner = logger.withSpinner('Writing server data files...', {
        successTitle: () => `Committed ${kleur.underline(seen.size)} server data files`,
      });

      const dataDir = app.dirs.vessel.server.resolve('.data');
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

    const manifestsDir = app.dirs.vessel.server.resolve('.manifests');
    mkdirp(manifestsDir);

    await manifestSpinner(async () => {
      await Promise.all(
        manifestNames.map(async (name) => {
          app.dirs.vessel.server.write(`${manifestsDir}/${name}.js`, manifests[name]!);
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

    const content = app.dirs.vessel.client.read(appChunkInfo.client.fileName);
    app.dirs.vessel.client.write(
      appChunkInfo.client.fileName,
      content.replace('"__VSL_CAN_FETCH__"', `[${canFetch.join(',')}]`),
    );
  }

  build.routes = await resolveAllRoutes(app, build);
  await adapter.write?.();

  // -------------------------------------------------------------------------------------------
  // CLOSE
  // -------------------------------------------------------------------------------------------

  logBadLinks(build.badLinks);
  await logRoutes(app, build);

  const { deoptimized } = serverChunkInfo;

  if (deoptimized.size > 0) {
    const edgeExport = kleur.cyan('export const EDGE = true;');
    logger.warn(
      kleur.bold('Deoptimized Routes'),
      '\nThe following route files were deoptimized from edge to node because of a server loader or action in their branch:\n',
      Array.from(deoptimized)
        .map(
          ([route, layouts]) =>
            `\n- ${kleur.bold(route.page?.path.route ?? route.id)}\n  ${layouts.map(
              (route) => `  - ${kleur.red(route.layout!.path.route)}`,
            )}`,
        )
        .join(''),
      `\n\n${kleur.bold('You can fix this by either:')}`,
      `\n\n- Removing ${edgeExport} from the listed page modules above.\n`,
      `\n- Or, by ensuring all deoptimizing layouts listed below them use the edge runtime by adding the mentioned \`EDGE\` export.`,
    );
  }

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
