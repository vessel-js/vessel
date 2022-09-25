import type { App } from 'node/app/App';
import { installPolyfills } from 'server/polyfills';
import type { PreviewServerHook } from 'vite';

import { handleDevServerError } from './server';

export async function configurePreviewServer(
  app: App,
  server: Parameters<PreviewServerHook>[0],
) {
  await installPolyfills();

  const protocol =
    app.vite.resolved!.server.https || app.vite.resolved!.preview.https
      ? 'https'
      : 'http';

  // TODO: read in preview manifest and create handler

  server.middlewares.use(async (req, res, next) => {
    try {
      if (!req.url || !req.method) {
        throw new Error('[vessel] incomplete request');
      }

      const base = `${protocol}://${
        req.headers[':authority'] || req.headers.host
      }`;

      // const url = new URL(base + req.url);
      const decodedUrl = decodeURI(new URL(base + req.url).pathname);

      if (
        app.routes.test(decodedUrl, 'page') ||
        app.routes.test(decodedUrl, 'http')
      ) {
        // TODO handle request here
      }
    } catch (error) {
      handleDevServerError(app, req, res, error);
      return;
    }

    next();
  });
}
