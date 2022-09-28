import type { App } from 'node/app/App';
import { getRouteFileTypes } from 'node/app/files';
import { AppRoute } from 'node/app/routes';
import type {
  GetManualChunk,
  OutputAsset,
  OutputBundle,
  OutputChunk,
} from 'rollup';
import { ALL_HTTP_METHODS, HTTP_METHODS } from 'server/http';
import { type RouteComponentType } from 'shared/routing';

import type { BuildData } from './build-data';

export function resolveHttpMethods(httpRoute: AppRoute, build: BuildData) {
  const methods =
    build.server.chunks
      .get(httpRoute.id)
      ?.http?.exports.filter((id) => HTTP_METHODS.has(id)) ?? [];

  // Done this way so it's sorted.
  return ALL_HTTP_METHODS.filter((method) => methods.includes(method));
}

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

export function resolveServerRoutes(
  app: App,
  chunks: BuildData['server']['chunks'],
) {
  const edgeRoutes: BuildData['edge']['routes'] = new Set();
  const serverLoaders: BuildData['server']['loaders'] = new Map();

  const routes = app.routes.toArray();

  const serverLayouts: string[] = [];
  const edgeLayouts: string[] = [];

  const hasEdgeExport = (exports: string[]) => exports.includes('EDGE');

  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i];

    let edge = false,
      server = false;

    const serverLoader: {
      [P in RouteComponentType]?: boolean;
    } = {};

    const chunk = chunks.get(route.id)!;

    for (const type of getRouteFileTypes()) {
      if (!route[type]) continue;

      if (type === 'http') {
        if (hasEdgeExport(chunk.http!.exports)) edgeRoutes.add(route.id);
      } else if (chunk[type]!.exports.includes('serverLoader')) {
        server = true;
        serverLoader[type] = true;

        const isEdge = hasEdgeExport(chunk[type]!.exports);
        if (isEdge) edge = true;

        if (type === 'layout') {
          serverLayouts.push(route.id);
          if (isEdge) edgeLayouts.push(route.id);
        }
      }
    }

    if (server || serverLayouts.some((id) => route.id.startsWith(id))) {
      serverLoaders.set(route.id, serverLoader);
      if (edge || edgeLayouts.some((id) => route.id.startsWith(id))) {
        edgeRoutes.add(route.id);
      }
    }
  }

  return { edgeRoutes, serverLoaders };
}
