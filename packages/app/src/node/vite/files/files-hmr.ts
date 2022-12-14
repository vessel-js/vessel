import * as path from 'pathe';
import type { ViteDevServer } from 'vite';

import type { App } from 'node/app/App';
import type { RouteFile } from 'node/app/files';

import { clearMarkdownCache } from '../../markdoc';
import { virtualModuleRequestPath } from '../alias';

export function handleFilesHMR(app: App) {
  const server = app.vite.server!;

  function clearLayoutChildrenMarkdownCache(layoutFilePath: string) {
    const branch = app.files.routes.getDirBranch(layoutFilePath);
    for (const { page } of branch) {
      if (page) {
        clearMarkdownCache(page.path.absolute);
        invalidateRouteModule(server, page);
      }
    }
  }

  const is = (filePath: string) => app.files.routes.is(filePath);

  onFileEvent(is, 'add', async (filePath) => {
    app.files.routes.add(filePath);

    if (app.files.routes.isLayoutFile(filePath)) {
      clearLayoutChildrenMarkdownCache(filePath);
    }

    return { reload: true };
  });

  onFileEvent(is, 'unlink', async (filePath) => {
    app.files.routes.remove(filePath);

    if (app.files.routes.isLayoutFile(filePath)) {
      clearLayoutChildrenMarkdownCache(filePath);
    }

    return { reload: true };
  });

  function onFileEvent(
    test: (path: string) => boolean,
    eventName: string,
    handler: (path: string) => Promise<void | null | { reload?: boolean }>,
  ) {
    server.watcher.on(eventName, async (p) => {
      const filePath = path.normalize(p);

      if (!test(filePath)) return;

      const { reload } = (await handler(filePath)) ?? {};

      if (reload) {
        fullReload();
      }
    });
  }

  function fullReload() {
    invalidateModuleByID(virtualModuleRequestPath.manifest);
    server.ws.send({ type: 'full-reload' });
  }

  function invalidateModuleByID(id: string) {
    const mod = server.moduleGraph.getModuleById(id);
    if (mod) server.moduleGraph.invalidateModule(mod);
  }
}

export function invalidateRouteModule(server: ViteDevServer, file: RouteFile) {
  const module = server.moduleGraph.getModulesByFile(file.path.absolute)?.values().next();

  if (module?.value) server.moduleGraph.invalidateModule(module.value);
}
