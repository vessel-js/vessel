import type { App } from 'node/app/App';
import type {
  GetManualChunk,
  OutputAsset,
  OutputBundle,
  OutputChunk,
} from 'rollup';
import {
  getRouteComponentTypes,
  type RouteComponentType,
} from 'shared/routing';

import type { BuildBundles, BuildData } from './build-data';

export function resolveChunks(bundle: OutputBundle) {
  const chunks: OutputChunk[] = [];

  for (const value of Object.values(bundle)) {
    if (value.type === 'chunk') {
      chunks.push(value);
    }
  }

  return chunks;
}

export function resolveChunksAndAssets(bundle: OutputBundle) {
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

export function resolveRoutesLoaderInfo(
  app: App,
  { server: { chunks } }: BuildBundles,
) {
  const staticRoutes: BuildData['staticRoutes'] = new Set();
  const serverRoutes: BuildData['serverRoutes'] = new Set();
  const serverLoadable: BuildData['serverLoadable'] = new Map();

  const routes = app.routes.toArray();
  const serverBranchIds: string[] = [];

  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i];

    if (serverBranchIds.some((id) => route.id.startsWith(id))) {
      staticRoutes.delete(route);
      serverRoutes.add(route);
      continue;
    }

    let server = false;
    const serverLoader: {
      [P in RouteComponentType]?: boolean;
    } = {};

    for (const type of getRouteComponentTypes()) {
      if (route[type]) {
        const filePath = route[type]!.path.absolute;
        const chunk = chunks.find((chunk) => chunk.facadeModuleId === filePath);
        if (chunk?.exports.includes('serverLoader')) {
          server = true;
          serverLoader[type] = true;
          if (type === 'layout') {
            serverBranchIds.push(route.id);
          }
        }
      }
    }

    if (server) {
      serverRoutes.add(route);
    } else {
      staticRoutes.add(route);
    }

    serverLoadable.set(route.id, serverLoader);
  }

  return { staticRoutes, serverRoutes, serverLoadable };
}
