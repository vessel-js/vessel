import type { ServerResponse } from 'http';
import type { App } from 'node/app/App';
import { MatchedServerRoute } from 'server';
import { createMatchedRoute, testRoute } from 'shared/routing';
import { isString } from 'shared/utils/unit';

import { callStaticLoader } from './static-loader';

export async function handleStaticDataRequest(
  url: URL,
  app: App,
  res: ServerResponse,
) {
  const pathname = decodeURIComponent(url.searchParams.get('pathname')!),
    id = decodeURIComponent(url.searchParams.get('id')!);

  const dataURL = new URL(url);
  dataURL.pathname = pathname;

  const route = app.routes.client.find((route) => route.file.routePath === id);

  if (!route || !testRoute(dataURL, route)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const match = createMatchedRoute(dataURL, {
    ...route,
    loader: () => app.vite.server!.ssrLoadModule(route.file.path),
  }) as MatchedServerRoute;

  const { staticLoader } = await match.loader();
  const output = await callStaticLoader(dataURL, match, staticLoader);

  if (output.redirect) {
    res.setHeader(
      'X-Vessel-Redirect',
      isString(output.redirect) ? output.redirect : output.redirect.path,
    );
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(output.data ?? {}));
}
