import type { ServerResponse } from 'http';
import type { App } from 'node/app/App';
import type { ServerMatchedRoute } from 'server/types';
import {
  createMatchedRoute,
  type RouteComponentType,
  testRoute,
} from 'shared/routing';
import { isString } from 'shared/utils/unit';

import { callStaticLoader } from '../static-data-loader';

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

  const route = app.routes
    .toArray()
    .find((route) => route.dir.route === id && route[type]);

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
      loader: () => app.vite.server!.ssrLoadModule(route[type]!.path.absolute),
    },
  }) as ServerMatchedRoute;

  const { staticLoader } = await match[type]!.loader();
  const output = await callStaticLoader(dataURL, match, staticLoader);

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
}
