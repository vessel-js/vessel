import type { App } from 'node/app/App';
import { handleIncomingMessage } from 'node/http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequestHandler } from 'server/http';
import { initManifestURLPatterns } from 'server/http/handle-request';
import { installPolyfills } from 'server/polyfills';
import type { ServerManifest } from 'server/types';
import { findRoute } from 'shared/routing';
import { coerceToError } from 'shared/utils/error';
import type { PreviewServerHook } from 'vite';

import { handleDevServerError, logDevError } from './dev-server';

export async function configurePreviewServer(
  app: App,
  server: Parameters<PreviewServerHook>[0],
) {
  await installPolyfills();

  const protocol =
    app.vite.resolved!.server.https || app.vite.resolved!.preview.https
      ? 'https'
      : 'http';

  const manifestPath = app.dirs.server.resolve('_manifests/preview.js');

  // Manifest won't exist if it's a completely static site.
  const manifest = (
    fs.existsSync(manifestPath) ? (await import(manifestPath)).default : null
  ) as ServerManifest | null;

  if (manifest) {
    initManifestURLPatterns(manifest);
  }

  const handler = manifest
    ? createRequestHandler({ dev: true, ...manifest })
    : null;

  server.middlewares.use((req, res, next) => {
    if (req.url?.startsWith('/_immutable')) {
      res.setHeader('Cache-Control', 'public, immutable, max-age=31536000');
      res.setHeader(
        'ETag',
        path.basename(req.url, path.extname(req.url)).replace(/^.+-/, ''),
      );
    }

    next();
  });

  server.middlewares.use(async (req, res, next) => {
    try {
      if (!req.url || !req.method) {
        throw new Error('[vessel] incomplete request');
      }

      const base = `${protocol}://${
        req.headers[':authority'] || req.headers.host
      }`;

      const url = new URL(base + req.url);

      if (
        manifest &&
        handler &&
        (findRoute(url, manifest.routes.app) ||
          findRoute(url, manifest.routes.http))
      ) {
        return await handleIncomingMessage(base, req, res, handler, (error) => {
          logDevError(app, req, coerceToError(error));
        });
      }
    } catch (error) {
      handleDevServerError(app, req, res, error);
      return;
    }

    next();
  });
}
