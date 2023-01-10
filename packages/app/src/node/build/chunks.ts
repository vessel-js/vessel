import * as path from 'pathe';
import type { GetManualChunk, OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import type { Manifest as ViteManifest } from 'vite';

import type { App } from 'node/app/App';
import { getRouteFileTypes, type RouteFileType } from 'node/app/files';
import { AppRoute } from 'node/app/routes';
import { ALL_HTTP_METHODS, resolveHandlerHttpMethod } from 'shared/http';
import { type RouteComponentType } from 'shared/routing';

import type { BuildBundles, BuildData } from './build-data';

export function resolveEntryChunkInfo(
  app: App,
  clientManifest: ViteManifest,
  clientChunks: OutputChunk[],
  serverChunks: OutputChunk[],
) {
  const rootPath = app.dirs.root.relative(app.config.entry.client);
  const clientFileName = clientManifest[rootPath].file;
  return {
    rootPath,
    client: {
      fileName: clientFileName,
      chunk: clientChunks.find((chunk) => chunk.isEntry && chunk.fileName === clientFileName)!,
    },
    server: {
      path: app.dirs.vessel.server.resolve('entry.js'),
      chunk: serverChunks.find((chunk) => chunk.isEntry && chunk.fileName === 'entry.js')!,
    },
    vite: {
      chunk: clientManifest[rootPath],
    },
  };
}

export function resolveAppChunkInfo(
  app: App,
  clientManifest: ViteManifest,
  clientChunks: OutputChunk[],
  serverChunks: OutputChunk[],
) {
  const rootPath = app.dirs.root.relative(app.config.client.app);
  const clientFileName = clientManifest[rootPath].file;
  return {
    rootPath,
    client: {
      fileName: clientFileName,
      chunk: clientChunks.find((chunk) => chunk.isEntry && chunk.fileName === clientFileName)!,
    },
    server: {
      chunk: serverChunks.find((chunk) => chunk.isEntry && chunk.fileName === 'app.js')!,
    },
    vite: {
      chunk: clientManifest[rootPath],
    },
  };
}

export function resolveServerConfigChunks(app: App, serverChunks: OutputChunk[]) {
  const chunks: BuildBundles['server']['configs'] = {};

  for (const config of app.files.serverConfigs) {
    const chunk = serverChunks.find((chunk) => chunk.facadeModuleId === config.path);

    if (chunk) chunks[config.type] = chunk;
  }

  return chunks;
}

export function resolveServerRouteChunks(app: App, serverChunks: OutputChunk[]) {
  const serverRouteChunks = new Map<string, { [P in RouteFileType]?: OutputChunk }>();

  const serverRouteChunkFiles = new Map<string, { [P in RouteFileType]?: string }>();

  // Resolve route chunks.
  for (const route of app.routes) {
    const chunks = {};
    const files = {};

    for (const type of getRouteFileTypes()) {
      if (route[type]) {
        const chunk = serverChunks.find(
          (chunk) => chunk.facadeModuleId === route[type]!.path.absolute,
        );
        if (chunk) {
          chunks[type] = chunk;
          files[type] = app.dirs.vessel.server.resolve(chunk.fileName);
        }
      }
    }

    serverRouteChunks.set(route.id, chunks);
    serverRouteChunkFiles.set(route.id, files);
  }

  return { serverRouteChunks, serverRouteChunkFiles };
}

export function resolveApiChunkMethods(route: AppRoute, build: BuildData) {
  const methods =
    build.bundles.server.routes.chunks
      .get(route.id)
      ?.api?.exports?.map((id) => resolveHandlerHttpMethod(id))
      .filter((handler) => typeof handler === 'string') ?? [];

  // Done this way so it's sorted and deduped.
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
      } else if (/\/@?solid-js\//.test(id) && !/@?solid-js\/node_modules/.test(id)) {
        return 'solid';
      } else if (/\/@vessel-js/.test(id) && !/@vessel-js\/node_modules/.test(id)) {
        return 'vessel';
      }
    }

    return null;
  };
}

export function resolveServerRoutes(app: App, chunks: BuildBundles['server']['routes']['chunks']) {
  const routes = app.routes.toArray();
  const edgeLayouts = new Set<string>();
  const nodeLayouts = new Set<string>();
  const serverLayouts: AppRoute[] = [];

  const deoptimized = new Map<AppRoute, AppRoute[]>();

  const edgeRoutes: BuildData['edge']['routes'] = new Set();
  const serverLoaders: BuildData['server']['loaders'] = new Map();

  const hasEdgeExport = (id: string, exports: string[]) =>
    edgeRoutes.has(id) || exports.includes('EDGE');

  if (app.config.routes.edge.length > 0) {
    const validId = new Set<string>(routes.map((route) => route.id));
    for (const file of app.dirs.app.glob(app.config.routes.edge)) {
      const id = `/${path.dirname(file)}`;
      if (validId.has(id)) edgeRoutes.add(id);
    }
  }

  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i];

    let edge = false,
      server = false;

    const serverLoader: {
      [P in RouteComponentType]?: boolean;
    } = {};

    const chunk = chunks.get(route.id)!;

    for (const type of getRouteFileTypes()) {
      if (!route[type]) {
        continue;
      } else if (type === 'api' && hasEdgeExport(route.id, chunk.api!.exports)) {
        edgeRoutes.add(route.id);
      } else if (chunk[type]!.exports.includes('serverLoader')) {
        server = true;
        serverLoader[type] = true;

        const isEdge = hasEdgeExport(route.id, chunk[type]!.exports);
        if (isEdge) edge = true;

        if (type === 'layout') {
          serverLayouts.push(route);
          (isEdge ? edgeLayouts : nodeLayouts).add(route.id);
        }
      }
    }

    const serverLayoutsBranch = serverLayouts.filter((layout) => route.id.startsWith(layout.id));

    if (server || serverLayoutsBranch.length > 0) {
      serverLoaders.set(route.id, serverLoader);

      if (edge || serverLayoutsBranch.some((layout) => edgeLayouts.has(layout.id))) {
        const nodeBranchLayouts = serverLayoutsBranch.filter((layout) =>
          nodeLayouts.has(layout.id),
        );

        if (nodeBranchLayouts.length > 0) {
          deoptimized.set(route, nodeBranchLayouts);
        } else {
          edgeRoutes.add(route.id);
        }
      }
    }
  }

  return { edgeRoutes, serverLoaders, deoptimized };
}
