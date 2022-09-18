import type { App } from 'node/app/App';
import { type RouteFile } from 'node/app/files';
import { installPolyfills } from 'server/polyfills';
import type { PreviewServerHook } from 'vite';

import { handleDevServerError } from './dev-server';
import { handleHttpRequest } from './handle-http';

export async function configurePreviewServer(
  app: App,
  server: Parameters<PreviewServerHook>[0],
) {
  await installPolyfills();

  const protocol =
    app.vite.resolved!.server.https || app.vite.resolved!.preview.https
      ? 'https'
      : 'http';

  const loader = (file: RouteFile) => {
    return import(
      app.dirs.server.resolve(file.path.route).replace(/\.ts$/, '.js')
    );
  };

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

      // TODO: handle dynamic pages here (SSR) -- load from manifest. -> __data param? or __http
      if (app.routes.test(decodedUrl, 'page')) {
        //
      }

      if (app.routes.test(decodedUrl, 'http')) {
        await handleHttpRequest({
          base,
          url,
          app,
          req,
          res,
          loader,
        });
        return;
      }
    } catch (error) {
      handleDevServerError(app, req, res, error);
      return;
    }

    next();
  });
}
