import type { App } from 'node/app/App';
import {
  createPageResource,
  type ServerPageResource,
  type ServerPageResourceEntry,
} from 'server';
import { noendslash } from 'shared/utils/url';
import type { Manifest as ViteManifest } from 'vite';

import type { BuildBundles } from './build-data';

export function resolveDocumentResourcesFromManifest(
  app: App,
  bundles: BuildBundles,
) {
  const manifest = bundles.client.manifest;
  const baseUrl = noendslash(app.vite.resolved!.base);

  const routeFiles = new Set(
    app.files.routes
      .toArray()
      .filter((file) => file.type !== 'api')
      .map((file) => file.path.root),
  );

  const resources: ServerPageResource[] = [];

  const resourceIndex = new Map<string, number>();
  const createResource = (filename: string) => {
    if (resourceIndex.has(filename)) {
      return resourceIndex.get(filename)!;
    } else {
      const index = resources.length;
      resources.push(createPageResource(filename, baseUrl));
      resourceIndex.set(filename, index);
      return index;
    }
  };

  const resolveResources = (entries: string[]) => {
    const resources: ServerPageResourceEntry[] = [];

    const { js, css, dynamicJs, dynamicCss } = resolveImportsFromManifest(
      manifest,
      entries,
      (file) => !routeFiles.has(file),
    );

    for (const file of [...js, ...css]) {
      const index = createResource(file);
      resources.push(index);
    }

    for (const file of [...dynamicJs, ...dynamicCss]) {
      const index = createResource(file);
      resources.push(-index);
    }

    return resources.reverse();
  };

  // Entry
  const entryId = bundles.client.entry.chunk.facadeModuleId!;
  const entryFile = app.dirs.root.relative(entryId);
  const entryResources = resolveResources([entryFile]);

  // App
  const appId = bundles.client.app.chunk.facadeModuleId!;
  const appFile = app.dirs.root.relative(appId);
  const appResources = resolveResources([appFile]);

  // Routes
  const routeResources: Record<string, ServerPageResourceEntry[]> = {};
  for (const route of app.routes.filterHasType('page')) {
    const branch = app.routes.getBranch(route);

    const entries = [
      ...branch
        .reverse()
        .flatMap((route) => [
          route.layout?.path.root,
          route.errorBoundary?.path.root,
        ]),
      route.page!.path.root,
    ].filter(Boolean) as string[];

    routeResources[route.id] = resolveResources(entries);
  }

  return {
    all: resources,
    entry: entryResources,
    app: appResources,
    routes: routeResources,
  };
}

export function resolveImportsFromManifest(
  manifest: ViteManifest,
  entries: string[],
  filterDynamicImports: (file: string) => boolean = () => true,
) {
  const seen = new Set<string>();

  const js = new Set<string>();
  const dynamicJs = new Set<string>();

  const css = new Set<string>();
  const dynamicCss = new Set<string>();

  function walk(file: string, lazy = false) {
    if (seen.has(file)) return;
    seen.add(file);

    const chunk = manifest[file];

    if (!lazy) {
      js.add(chunk.file);
    } else {
      dynamicJs.add(chunk.file);
    }

    if (chunk.css) {
      for (const file of chunk.css) {
        if (!lazy) {
          css.add(file);
        } else {
          dynamicCss.add(file);
        }
      }
    }

    if (chunk.imports) {
      for (const file of chunk.imports) walk(file, lazy);
    }

    if (chunk.dynamicImports) {
      for (const file of chunk.dynamicImports) {
        if (filterDynamicImports(file)) walk(file, true);
      }
    }
  }

  const files: Record<string, string> = {};

  for (const entry of entries) {
    walk(entry);
    files[entry] = manifest[entry].file;
  }

  return {
    files,
    js: Array.from(js),
    dynamicJs: Array.from(dynamicJs),
    css: Array.from(css),
    dynamicCss: Array.from(dynamicCss),
  };
}
