import type { ServerResponse } from 'http';
import type { Connect } from 'vite';

import type { App } from 'node/app/App';
import { handleIncomingMessage } from 'node/http';
import { createServer } from 'server/http';
import type { ServerManifest } from 'server/types';
import { resolveStaticDataAssetId } from 'shared/data';
import { HTML_DOCUMENT_HTTP_METHOD } from 'shared/http';
import { getRouteComponentTypes, matchRoute } from 'shared/routing';
import { coerceError } from 'shared/utils/error';

import { handleDevServerError, logDevError } from './dev-server';
import { resolveDevStylesheets } from './resolve-stylesheets';
import { createStaticLoaderFetch, loadStaticRoute } from './static-data-loader';

type HandleDevRequestInit = {
  base: string;
  app: App;
  url: URL;
  req: Connect.IncomingMessage;
  res: ServerResponse;
  manifest: ServerManifest;
};

export async function handleDevRequest({
  base,
  app,
  url,
  req,
  res,
  manifest,
}: HandleDevRequestInit) {
  url.pathname = url.pathname.replace('/index.html', '/');

  try {
    const method = req.method;
    const accepts = req.headers['accept'];
    const acceptsHTML = accepts && /\btext\/html\b/.test(accepts);

    if (method && acceptsHTML && HTML_DOCUMENT_HTTP_METHOD.has(method)) {
      const route = matchRoute(url, app.routes.filterHasType('page'));

      manifest.dev!.stylesheets = async () => (route ? resolveDevStylesheets(app, route) : '');
      manifest.staticData.loaders = {};

      const serverFetch = createStaticLoaderFetch(app, manifest);

      if (route) {
        const { matches, redirect } = await loadStaticRoute(
          app,
          url,
          route,
          serverFetch,
          (route, type) => route[type]!.viteLoader(),
        );

        if (redirect) {
          res.statusCode = redirect.status;
          res.setHeader('Location', redirect.path);
          res.end();
          return;
        }

        for (const match of matches) {
          for (const type of getRouteComponentTypes()) {
            if (match[type]?.staticData) {
              const id = resolveStaticDataAssetId(match, type);
              manifest.staticData.loaders![id] = () =>
                Promise.resolve({ data: match[type]!.staticData ?? {} });
            }
          }
        }
      }
    }

    const handler = createServer(manifest);
    await handleIncomingMessage(base, req, res, handler, (error) => {
      logDevError(app, req, coerceError(error));
    });
  } catch (error) {
    handleDevServerError(app, req, res, error);
  }
}
