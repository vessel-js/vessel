import { watch } from 'chokidar';
import kleur from 'kleur';
import type { App } from 'node/app/App';
import type { ServerResponse } from 'node:http';
import { STATIC_DATA_ASSET_BASE_PATH } from 'shared/data';
import { coerceError } from 'shared/utils/error';
import type { Connect, ViteDevServer } from 'vite';

import {
  initDevServerManifest,
  updateDevServerManifestRoutes,
} from './dev-server-manifest';
import { handleDevRequest } from './handle-dev-request';
import { handleStaticDataRequest } from './handle-static-data';
import { readIndexHtmlFile } from './index-html';

export async function configureDevServer(app: App, server: ViteDevServer) {
  const protocol = server.config.server.https ? 'https' : 'http';
  const manifest = initDevServerManifest(app);

  await updateDevServerManifestRoutes(app, manifest);

  let timeout: NodeJS.Timeout | null = null;
  const debounce = (callback: () => void) => {
    return () => {
      timeout && clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        callback();
      }, 150);
    };
  };

  let updatingManifest = Promise.resolve();
  const updateManifest = debounce(() => {
    updatingManifest = updateDevServerManifestRoutes(app, manifest);
  });

  app.routes.onAdd(updateManifest);
  app.routes.onRemove(updateManifest);

  const watcher = watch(app.files.serverConfigGlob).on('all', updateManifest);
  app.vite.server!.httpServer!.on('close', () => {
    watcher.close();
  });

  return {
    pre: () => {
      // no-op
    },
    post: () => {
      server.middlewares.use(async (req, res) => {
        try {
          if (!req.url || !req.method) {
            throw new Error('[vessel] incomplete request');
          }

          const base = `${protocol}://${
            req.headers[':authority'] || req.headers.host
          }`;

          const url = new URL(base + req.url);
          const pathname = decodeURI(url.pathname);

          // We want to wait for latest update.
          let current: Promise<void> | null = null;
          while (current !== updatingManifest) {
            current = updatingManifest;
            await current;
          }

          manifest.document.template =
            await app.vite.server!.transformIndexHtml(
              decodeURI(url.pathname),
              readIndexHtmlFile(app),
              req.originalUrl,
            );

          if (pathname.startsWith(STATIC_DATA_ASSET_BASE_PATH)) {
            return await handleStaticDataRequest({ url, app, res, manifest });
          }

          return await handleDevRequest({ base, url, app, req, res, manifest });
        } catch (error) {
          handleDevServerError(app, req, res, error);
          return;
        }
      });
    },
  };
}

export function logDevError(
  app: App,
  req: Connect.IncomingMessage,
  error: Error,
) {
  app.logger.error(
    error.message,
    [
      `\n${kleur.bold('URL:')} ${req.url ?? '?'}`,
      `${kleur.bold('METHOD:')} ${req.method ?? '?'}`,
      '',
      '',
    ].join('\n'),
    error.stack,
    '\n',
  );
}

export function handleDevServerError(
  app: App,
  req: Connect.IncomingMessage,
  res: ServerResponse,
  e: unknown,
) {
  const error = coerceError(e);
  logDevError(app, req, error);
  res.statusCode = 500;
  res.end(error.stack);
}

export function getDevServerOrigin(app: App) {
  const ssrProtocol = app.vite.resolved!.server.https ? 'https' : 'http';
  return `${ssrProtocol}://localhost`;
}
