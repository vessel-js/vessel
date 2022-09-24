import kleur from 'kleur';
import type { App } from 'node/app/App';
import type { RouteFile } from 'node/app/files';
import type { ServerResponse } from 'node:http';
import { STATIC_DATA_ASSET_BASE_PATH } from 'shared/data';
import { coerceToError } from 'shared/utils/error';
import type { Connect, ViteDevServer } from 'vite';

import { handleHttpRequest } from './handle-http';
import { handlePageRequest } from './handle-page';
import { handleStaticDataRequest } from './handle-static-data';

export function configureDevServer(app: App, server: ViteDevServer) {
  removeHtmlMiddlewares(server.middlewares);

  const httpLoader = (file: RouteFile) =>
    app.vite.server!.ssrLoadModule(file.path.absolute);

  const protocol = server.config.server.https ? 'https' : 'http';

  server.middlewares.use(async (req, res, next) => {
    try {
      if (!req.url || !req.method) {
        throw new Error('[vessel] incomplete request');
      }

      const base = `${protocol}://${
        req.headers[':authority'] || req.headers.host
      }`;

      const url = new URL(base + req.url);
      const decodedUrl = decodeURI(new URL(base + req.url).pathname);

      if (decodedUrl.startsWith(STATIC_DATA_ASSET_BASE_PATH)) {
        return await handleStaticDataRequest({ url, app, res });
      }

      if (app.routes.test(decodedUrl, 'page')) {
        return await handlePageRequest({
          base,
          url,
          app,
          req,
          res,
        });
      }

      if (app.routes.test(decodedUrl, 'http')) {
        return await handleHttpRequest({
          dev: true,
          base,
          url,
          app,
          req,
          res,
          loader: httpLoader,
        });
      }
    } catch (error) {
      handleDevServerError(app, req, res, error);
      return;
    }

    next();
  });
}

function removeHtmlMiddlewares(server) {
  const middlewares = ['viteIndexHtmlMiddleware', 'viteSpaFallbackMiddleware'];
  for (let i = server.stack.length - 1; i > 0; i--) {
    if (middlewares.includes(server.stack[i].handle.name)) {
      server.stack.splice(i, 1);
    }
  }
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
  const error = coerceToError(e);
  logDevError(app, req, error);
  res.statusCode = 500;
  res.end(error.stack);
}

export function getDevServerOrigin(app: App) {
  const ssrProtocol = app.vite.resolved!.server.https ? 'https' : 'http';
  return `${ssrProtocol}://localhost`;
}
