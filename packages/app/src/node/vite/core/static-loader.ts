import kleur from 'kleur';
import type { App } from 'node/app/App';
import {
  createLoadablePageSegments,
  type PageFileRoute,
  type SystemFileRoute,
} from 'node/app/routes';
import { logger } from 'node/utils';
import { createStaticLoaderInput } from 'server';
import type {
  LoadedServerRoute,
  ServerModule,
  ServerRedirect,
  StaticLoader,
  StaticLoaderCacheKeyBuilder,
  StaticLoaderCacheMap,
  StaticLoaderInput,
  StaticLoaderOutput,
} from 'server/types';
import { MatchedRoute } from 'shared/routing';
import { isFunction } from 'shared/utils/unit';

export type LoadStaticRouteResult = {
  route: LoadedServerRoute;
  redirect?: ServerRedirect;
};

export async function loadStaticRoute(
  app: App,
  url: URL,
  page: PageFileRoute,
  load: (route: SystemFileRoute) => Promise<ServerModule>,
  canLoad: (route: SystemFileRoute) => boolean = () => true,
): Promise<LoadStaticRouteResult> {
  const input = createStaticLoaderInput(url, page);
  const segments = createLoadablePageSegments(app, page, load);

  const loaded = await Promise.all(
    segments.map(async (segment) => {
      //
    }),
  );

  // if (output.redirect) {
  //   const path = isString(output.redirect)
  //     ? output.redirect
  //     : output.redirect.path;

  //   const status = isString(output.redirect)
  //     ? 302
  //     : output.redirect.status ?? 302;

  //   const normalizedPath = !isLinkExternal(path, app.vite.resolved!.base)
  //     ? slash(path)
  //     : path;
  // }
}

const loaderCache = new Map<string, StaticLoaderCacheMap>();
const cacheKeyBuilder = new Map<string, StaticLoaderCacheKeyBuilder>();

export function clearStaticLoaderCache(id: string) {
  loaderCache.delete(id);
  cacheKeyBuilder.delete(id);
}

export async function callStaticLoader(
  url: URL,
  route: MatchedRoute,
  staticLoader?: StaticLoader,
): Promise<StaticLoaderOutput> {
  const id = route.id;
  const input = createStaticLoaderInput(url, route);

  if (!staticLoader) {
    clearStaticLoaderCache(id);
    return {};
  }

  if (cacheKeyBuilder.has(id)) {
    const buildCacheKey = cacheKeyBuilder.get(id)!;
    const cacheKey = await buildCacheKey(input);
    const cache = loaderCache.get(id);
    if (cacheKey && cache && cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
  }

  const output = (await staticLoader(input)) ?? {};
  const data = output.data;
  const buildCacheKey = output.cache;
  const isDataValid = !data || typeof data === 'object';

  if (isDataValid && isFunction(buildCacheKey)) {
    const cacheKey = await buildCacheKey(input);

    if (cacheKey) {
      const cache = loaderCache.get(id) ?? new Map();
      cache.set(cacheKey, output);
      loaderCache.set(id, cache);
    }

    cacheKeyBuilder.set(id, buildCacheKey);
  }

  if (!isDataValid) {
    logger.warn(
      'Received invalid data from loader (expected object).',
      [
        `\n${kleur.bold('File:')} ${route.id}`,
        `${kleur.bold('Data Type:')} ${typeof output.data}`,
      ].join('\n'),
      '\n',
    );

    output.data = {};
  }

  if (buildCacheKey && !isFunction(buildCacheKey)) {
    logger.warn(
      'Received invalid cache builder from loader (expected function).',
      [
        `\n${kleur.bold('File:')} ${route.id}`,
        `${kleur.bold('Cache Type:')} ${typeof buildCacheKey}`,
      ].join('\n'),
      '\n',
    );
  }

  return output;
}
