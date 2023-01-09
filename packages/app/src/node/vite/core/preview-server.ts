import type { App } from 'node/app/App';
import { handleIncomingMessage } from 'node/http';
import { installPolyfills } from 'node/polyfills';
import fs from 'node:fs';
import * as path from 'pathe';
import { createServer } from 'server/http';
import type { ServerManifest } from 'server/types';
import { coerceError } from 'shared/utils/error';
import type { PreviewServerHook } from 'vite';

import { handleDevServerError, logDevError } from './dev-server';

export async function configurePreviewServer(app: App, server: Parameters<PreviewServerHook>[0]) {
  await installPolyfills();

  const protocol =
    app.vite.resolved!.server.https || app.vite.resolved!.preview.https ? 'https' : 'http';

  const manifestPath = app.dirs.vessel.server.resolve('.manifests/node.js');

  // Manifest won't exist if it's a completely static site.
  const manifest = (
    fs.existsSync(manifestPath) ? (await import(manifestPath)).default : null
  ) as ServerManifest | null;

  const handler = manifest ? createServer(manifest) : null;

  return {
    pre: () => {
      immutableHeaderMiddleware(server);
    },
    post: () => {
      if (manifest && handler) {
        server.middlewares.use(async (req, res) => {
          try {
            if (!req.url || !req.method) {
              throw new Error('[vessel] incomplete request');
            }

            const base = `${protocol}://${req.headers[':authority'] || req.headers.host}`;

            return await handleIncomingMessage(base, req, res, handler, (error) => {
              logDevError(app, req, coerceError(error));
            });
          } catch (error) {
            handleDevServerError(app, req, res, error);
            return;
          }
        });
      }
    },
  };
}

function immutableHeaderMiddleware(server: Parameters<PreviewServerHook>[0]) {
  server.middlewares.use((req, res, next) => {
    if (req.url?.startsWith('/_immutable')) {
      res.setHeader('Cache-Control', 'public, immutable, max-age=31536000');
      res.setHeader('ETag', path.basename(req.url, path.extname(req.url)).replace(/^.+-/, ''));
    }

    next();
  });
}
