import type { ModuleNode, ViteDevServer } from 'vite';

import type { App } from 'node/app/App';
import type { AppRoute } from 'node/app/routes';

export async function resolveDevStylesheets(app: App, route: AppRoute) {
  const stylesMap = await Promise.all(
    [
      app.config.client.app,
      ...app.routes.getLayoutBranch(route).map((layout) => layout.path.absolute),
      route.page!.path.absolute,
    ].map((file) => getStylesByFile(app.vite.server!, file)),
  );

  // Prevent FOUC during development.
  return [
    '<style id="__VSL_SSR_STYLES__" type="text/css">',
    stylesMap.map(Object.values).flat().join('\n'),
    '</style>',
  ].join('\n');
}

// Vite doesn't expose this so we just copy the list for now
const styleRE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss)$/;
export async function getStylesByFile(server: ViteDevServer, file: string) {
  const files = await server.moduleGraph.getModulesByFile(file);
  const node = Array.from(files ?? [])[0];

  if (!node) return {};

  const deps = new Set<ModuleNode>();
  await findModuleDeps(server, node, deps);

  const styles: Record<string, string> = {};

  for (const dep of deps) {
    const parsed = new URL(dep.url, 'http://localhost/');
    const query = parsed.searchParams;

    if (
      styleRE.test(dep.file!) ||
      (query.has('svelte') && query.get('type') === 'style') ||
      (query.has('vue') && query.get('type') === 'style')
    ) {
      try {
        const mod = await server.ssrLoadModule(dep.url);
        styles[dep.url] = mod.default;
      } catch {
        // no-op
      }
    }
  }

  return styles;
}

export async function findModuleDeps(
  server: ViteDevServer,
  node: ModuleNode,
  deps: Set<ModuleNode>,
) {
  const edges: Promise<void>[] = [];

  async function add(node: ModuleNode) {
    if (!deps.has(node)) {
      deps.add(node);
      await findModuleDeps(server, node, deps);
    }
  }

  async function addByUrl(url: string) {
    const node = await server.moduleGraph.getModuleByUrl(url);
    if (node) await add(node);
  }

  if (node.ssrTransformResult) {
    if (node.ssrTransformResult.deps) {
      node.ssrTransformResult.deps.forEach((url) => edges.push(addByUrl(url)));
    }
  } else {
    node.importedModules.forEach((node) => edges.push(add(node)));
  }

  await Promise.all(edges);
}
