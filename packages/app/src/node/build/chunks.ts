import type { App } from 'node/app/App';
import type { AppRoute } from 'node/app/routes';
import type { GetManualChunk } from 'rollup';
import { getRouteComponentTypes } from 'shared/routing';
import type { ManifestChunk as ViteManifestChunk } from 'vite';

import type { BuildBundles, BuildData } from './build';

export function extendManualChunks(): GetManualChunk {
  return (id) => {
    if (id.includes('vite/')) return 'vite';

    if (id.includes('node_modules')) {
      if (/\/@?svelte\//.test(id) && !/@?svelte\/node_modules/.test(id)) {
        return 'svelte';
      } else if (/\/@?vue\//.test(id) && !/@?vue\/node_modules/.test(id)) {
        return 'vue';
      } else if (/\/@?react\//.test(id) && !/@?react\/node_modules/.test(id)) {
        return 'react';
      } else if (
        /\/@?solid-js\//.test(id) &&
        !/@?solid-js\/node_modules/.test(id)
      ) {
        return 'solid';
      } else if (
        /\/@vessel-js/.test(id) &&
        !/@vessel-js\/node_modules/.test(id)
      ) {
        return 'vessel';
      }
    }

    return null;
  };
}

export function resolveLoaderChunks(
  app: App,
  { chunks }: BuildBundles['server'],
) {
  const staticLoaderRoutes: BuildData['staticLoaderRoutes'] = new Set();
  const serverLoaderRoutes: BuildData['serverLoaderRoutes'] = new Set();

  const routes = app.routes.toArray();

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    for (const type of getRouteComponentTypes()) {
      if (route[type]) {
        const filePath = route[type]!.path.absolute;
        const chunk = chunks.find((chunk) => chunk.facadeModuleId === filePath);

        if (chunk?.exports.includes('staticLoader')) {
          staticLoaderRoutes.add(route);
        }

        if (chunk?.exports.includes('serverLoader')) {
          serverLoaderRoutes.add(route);
        }
      }
    }
  }

  return { staticLoaderRoutes, serverLoaderRoutes };
}

export function resolvePageResources(
  app: App,
  route: AppRoute,
  { entryChunk, appChunk, viteManifest }: BuildBundles['client'],
) {
  const imports = new Set<string>();
  const dynamicImports = new Set<string>();
  const assets = new Set<string>();

  const pageSrc = new Set(
    app.files.routes.toArray('page').map((file) => file.path.root),
  );

  const layoutSrc = new Set(
    app.files.routes.toArray('layout').map((file) => file.path.root),
  );

  const errorBoundarySrc = new Set(
    app.files.routes.toArray('errorBoundary').map((file) => file.path.root),
  );

  const seen = new WeakSet<ViteManifestChunk>();
  const collectChunks = (chunk?: ViteManifestChunk, page = false) => {
    if (!chunk || seen.has(chunk) || (!page && pageSrc.has(chunk.src!))) {
      return;
    }

    if (chunk.assets) {
      for (const id of chunk.assets) {
        const asset = viteManifest[id];
        if (asset) assets.add(asset.file);
      }
    }

    if (chunk.imports) {
      for (const id of chunk.imports) {
        const chunk = viteManifest[id];
        if (chunk) {
          collectChunks(chunk);
          imports.add(chunk.file);
        }
      }
    }

    if (chunk.dynamicImports) {
      for (const id of chunk.dynamicImports) {
        const chunk = viteManifest[id];
        if (
          chunk &&
          !imports.has(chunk.file) &&
          !pageSrc.has(chunk.src!) &&
          !layoutSrc.has(chunk.src!) &&
          !errorBoundarySrc.has(chunk.src!)
        ) {
          dynamicImports.add(chunk.file);
        }
      }
    }

    seen.add(chunk);
  };

  // Entry

  const entryId = app.dirs.root.relative(entryChunk.facadeModuleId!);
  collectChunks(viteManifest[entryId]);
  imports.add(entryChunk.fileName);

  // App

  const appId = app.dirs.root.relative(appChunk.facadeModuleId!);
  collectChunks(viteManifest[appId]);
  imports.add(appChunk.fileName);

  // Layouts + Error Boundaries

  const branch = app.routes.getBranch(route);
  for (const { layout, errorBoundary } of branch) {
    if (layout) {
      const chunk = viteManifest[layout.path.root];
      if (chunk) {
        collectChunks(chunk);
        imports.add(chunk.file);
      }
    }

    if (errorBoundary) {
      const chunk = viteManifest[errorBoundary.path.root];
      if (chunk) {
        collectChunks(chunk);
        imports.add(chunk.file);
      }
    }
  }

  // Page

  const pageChunk = viteManifest[route.page!.path.root];

  if (pageChunk) {
    collectChunks(pageChunk, true);
    imports.add(pageChunk.file);
  }

  return {
    assets: Array.from(assets),
    imports: Array.from(imports),
    dynamicImports: Array.from(dynamicImports),
  };
}
