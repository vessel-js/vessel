import type { ServerResponse } from 'http';
import kleur from 'kleur';
import type { App } from 'node/app/App';
import { logger } from 'node/utils';
import type { ServerManifest, ServerMatchedPageRoute } from 'server/types';
import {
  createMatchedRoute,
  type RouteComponentType,
  testRoute,
} from 'shared/routing';
import { coerceError } from 'shared/utils/error';
import { isString } from 'shared/utils/unit';

import {
  callStaticLoader,
  createStaticLoaderFetch,
} from './static-data-loader';

type HandleStaticDataRequestInit = {
  url: URL;
  app: App;
  res: ServerResponse;
  manifest: ServerManifest;
};

export async function handleStaticDataRequest({
  url,
  app,
  res,
  manifest,
}: HandleStaticDataRequestInit) {
  const pathname = decodeURIComponent(url.searchParams.get('pathname')!),
    id = decodeURIComponent(url.searchParams.get('id')!),
    type = url.searchParams.get('type')! as RouteComponentType;

  const dataURL = new URL(url);
  dataURL.pathname = pathname;

  const route = app.routes
    .toArray()
    .find((route) => route.id === id && route[type]);

  if (!route || !testRoute(dataURL, route)) {
    res.setHeader('X-Vessel-Data', 'no');
    res.statusCode = 200;
    res.end();
    return;
  }

  const match = createMatchedRoute(dataURL, {
    ...route,
    [type]: {
      ...route[type],
      loader: () => route[type]!.viteLoader(),
    },
  }) as ServerMatchedPageRoute;

  const { staticLoader } = await match[type]!.loader();
  const serverFetch = createStaticLoaderFetch(app, manifest);

  try {
    const response = await callStaticLoader(
      dataURL,
      match,
      serverFetch,
      staticLoader,
    );

    if (response.redirect) {
      res.setHeader(
        'X-Vessel-Redirect',
        isString(response.redirect)
          ? response.redirect
          : response.redirect.path,
      );
    }

    res.statusCode = 200;
    res.setHeader('X-Vessel-Data', 'yes');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response.data ?? {}));
  } catch (e) {
    const error = coerceError(e);

    logger.error(
      error.message,
      `\n\n${kleur.bold('URL:')} ${url.pathname}${url.search}`,
      `\n\n${error.stack}`,
      '\n',
    );

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: error.message, stack: error.stack }));
  }
}
