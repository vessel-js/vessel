import type { App } from 'node/app/App';
import { STRIP_MARKDOC_DIR_RE } from 'node/app/files';
import { clearMarkdownCache } from 'node/markdoc';
import * as path from 'pathe';

export function handleMarkdownHMR(app: App) {
  const schema = app.markdoc;
  const files = app.files.markdoc;
  const isMarkdownNode = (filePath) => files.isAnyNode(filePath);

  onFileEvent(isMarkdownNode, 'add', async (filePath) => {
    files.add(filePath);

    const owningDir = filePath.replace(STRIP_MARKDOC_DIR_RE, '');

    if (app.files.routes.isLayoutFile(filePath)) {
      for (const pageFile of app.files.routes.toArray('page')) {
        if (pageFile.path.absolute.startsWith(owningDir)) {
          clearMarkdownCache(pageFile.path.absolute);
          invalidateFile(pageFile.path.absolute);
        }
      }
    }

    for (const route of app.routes.filterHasType('page')) {
      if (route.page!.path.absolute.startsWith(owningDir)) {
        const pageFilePath = route.page!.path.absolute;
        clearMarkdownCache(pageFilePath);
        invalidateFile(pageFilePath);
      }
    }

    return { reload: true };
  });

  onFileEvent(isMarkdownNode, 'unlink', async (filePath) => {
    files.remove(filePath);

    const hmrFiles = schema.hmrFiles.get(filePath);

    if (hmrFiles) {
      for (const file of hmrFiles) {
        clearMarkdownCache(file);
        invalidateFile(file);
      }
    }

    schema.hmrFiles.delete(filePath);
    return { reload: true };
  });

  function onFileEvent(
    test: (path: string) => boolean,
    eventName: string,
    handler: (path: string) => Promise<void | null | { reload?: boolean }>,
  ) {
    app.vite.server!.watcher.on(eventName, async (p) => {
      const filePath = path.normalize(p);

      if (!test(filePath)) return;

      const { reload } = (await handler(filePath)) ?? {};

      if (reload) {
        app.vite.server!.ws.send({ type: 'full-reload' });
      }
    });
  }

  function invalidateFile(filePath: string) {
    app.vite.server!.moduleGraph.getModulesByFile(filePath)?.forEach((mod) => {
      return app.vite.server!.moduleGraph.invalidateModule(mod);
    });
  }
}
