import type { ServerResponse } from 'http';
import kleur from 'kleur';
import type { App } from 'node/app/App';
import { logger } from 'node/utils';
import type { ServerMatchedRoute } from 'server/types';
import {
  createMatchedRoute,
  type RouteComponentType,
  testRoute,
} from 'shared/routing';
import { coerceToError } from 'shared/utils/error';
import { isString } from 'shared/utils/unit';

import {
  callStaticLoader,
  createStaticLoaderFetcher,
} from './static-data-loader';

type HandleStaticDataRequestInit = {
  app: App;
  url: URL;
  res: ServerResponse;
};

export async function handleStaticDataRequest({
  app,
  url,
  res,
}: HandleStaticDataRequestInit) {
  const pathname = decodeURIComponent(url.searchParams.get('pathname')!),
    id = decodeURIComponent(url.searchParams.get('id')!),
    type = url.searchParams.get('type')! as RouteComponentType;

  const dataURL = new URL(url);
  dataURL.pathname = pathname;

  const fetcher = createStaticLoaderFetcher(app, (route) =>
    route.http!.viteLoader(),
  );

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
  }) as ServerMatchedRoute;

  const { staticLoader } = await match[type]!.loader();

  try {
    const output = await callStaticLoader(
      dataURL,
      match,
      fetcher,
      staticLoader,
    );

    if (output.redirect) {
      res.setHeader(
        'X-Vessel-Redirect',
        isString(output.redirect) ? output.redirect : output.redirect.path,
      );
    }

    res.statusCode = 200;
    res.setHeader('X-Vessel-Data', 'yes');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(output.data ?? {}));
  } catch (e) {
    const error = coerceToError(e);

    logger.error(
      error.message,
      [`\n${kleur.bold('URL:')} ${url}`, '', ''].join('\n'),
      error.stack,
      '\n',
    );

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: error.message, stack: error.stack }));
  }
}
