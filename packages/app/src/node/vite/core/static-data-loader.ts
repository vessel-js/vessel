import kleur from 'kleur';
import type { App } from 'node/app/App';
import type { RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import { logger } from 'node/utils';
import { handleHttpError, handleHttpRequest } from 'server';
import { createStaticLoaderInput } from 'server/static-data';
import type {
  MaybeStaticLoaderOutput,
  ServerFetcher,
  ServerHttpModule,
  ServerLoadedRoute,
  ServerModule,
  ServerRedirect,
  StaticLoader,
  StaticLoaderCacheKeyBuilder,
  StaticLoaderCacheMap,
  StaticLoaderOutput,
} from 'server/types';
import { ALL_HTTP_METHODS, coerceFetchInput, httpError } from 'shared/http';
import {
  getRouteComponentTypes,
  matchAllRoutes,
  matchRoute,
  type Route,
  type RouteComponentType,
  type RouteMatch,
  stripRouteComponentTypes,
} from 'shared/routing';
import type { Mutable } from 'shared/types';
import { isFunction, isString } from 'shared/utils/unit';
import { isLinkExternal, slash } from 'shared/utils/url';

import { getDevServerOrigin } from './dev-server';

// Create fetcher to ensure relative paths work when fetching inside `staticLoader`. Also
// ensures requests are able to load HTTP modules so they can respond because there's no server here.
export function createStaticLoaderFetcher(
  app: App,
  loader: (route: AppRoute) => Promise<ServerHttpModule>,
): ServerFetcher {
  const ssrOrigin = getDevServerOrigin(app);
  const httpRoutes = app.routes.filterHasType('http');

  return (input, init) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      const url = new URL(`${ssrOrigin}${input}`);
      const route = matchRoute(url, httpRoutes);

      if (!route) {
        return Promise.resolve(handleHttpError(httpError('not found', 404)));
      }

      return handleHttpRequest(url, coerceFetchInput(input, init, url), {
        ...route,
        loader: () => loader(route),
        methods: ALL_HTTP_METHODS,
      });
    }

    return fetch(input, init);
  };
}

export type LoadStaticRouteResult = {
  matches: ServerLoadedRoute[];
  redirect?: ServerRedirect;
};

const getServerModuleKey = (
  route: Route & RouteMatch,
  type: RouteComponentType,
) => route.id + type;
const serverModules = new Map<string, ServerModule>();

const getStaticDataKey = (
  url: URL,
  route: Route & RouteMatch,
  type: RouteComponentType,
) => route.id + type + url.pathname;
const staticData = new Map<string, MaybeStaticLoaderOutput>();

export async function loadStaticRoute(
  app: App,
  url: URL,
  route: AppRoute,
  fetcher: ServerFetcher,
  load: (route: AppRoute, type: RouteFileType) => Promise<ServerModule>,
): Promise<LoadStaticRouteResult> {
  const branch = app.routes.getBranch(route);
  const matches = matchAllRoutes(url, branch, app.config.routes.trailingSlash);

  // load modules - ensuring we only do it once for a given route/type combo
  await Promise.all(
    matches.map(async (match) => {
      await Promise.all(
        getRouteComponentTypes().map(async (type) => {
          if (match[type]) {
            const key = getServerModuleKey(match, type);
            if (!serverModules.has(key)) {
              serverModules.set(key, await load(match, type));
            }
          }
        }),
      );
    }),
  );

  // load static data - ensuring we only do it once for a given route/type/path combo
  await Promise.all(
    matches.map(async (match) => {
      await Promise.all(
        getRouteComponentTypes().map(async (type) => {
          if (match[type]) {
            const key = getStaticDataKey(url, match, type);
            if (!staticData.has(key)) {
              const modKey = getServerModuleKey(match, type);
              const mod = serverModules.get(modKey)!;
              if (mod) {
                const data = await callStaticLoader(
                  url,
                  match,
                  fetcher,
                  mod.staticLoader,
                );
                staticData.set(key, data);
              }
            }
          }
        }),
      );
    }),
  );

  const results: ServerLoadedRoute[] = [];
  const baseUrl = app.vite.resolved!.base;

  // Go backwards for render order.
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];

    const result: Mutable<ServerLoadedRoute> = stripRouteComponentTypes(match);

    for (const type of getRouteComponentTypes()) {
      if (match[type]) {
        const mod = serverModules.get(getServerModuleKey(match, type))!;
        const data = staticData.get(getStaticDataKey(url, match, type));

        if (data?.redirect) {
          return {
            redirect: normalizeRedirectPath(data.redirect, baseUrl),
            matches: [],
          };
        }

        result[type] = {
          module: mod,
          loader: () => Promise.resolve(mod),
          staticData: data?.data ? data.data : undefined,
        };
      }
    }

    results.push(result);
  }

  if (!app.config.isBuild) {
    serverModules.clear();
    staticData.clear();
  }

  return { matches: results };
}

function normalizeRedirectPath(
  redirect: string | Partial<ServerRedirect>,
  baseUrl = '/',
): ServerRedirect {
  const path = isString(redirect) ? redirect : redirect.path!;
  const status = isString(redirect) ? 302 : redirect.status ?? 302;
  const normalizedPath = !isLinkExternal(path, baseUrl) ? slash(path) : path;
  return { path: normalizedPath, status };
}

const loaderCache = new Map<string, StaticLoaderCacheMap>();
const cacheKeyBuilder = new Map<string, StaticLoaderCacheKeyBuilder>();

export function clearStaticLoaderCache(id: string) {
  loaderCache.delete(id);
  cacheKeyBuilder.delete(id);
}

const warned = new Set<string>();

export async function callStaticLoader(
  url: URL,
  route: Route & RouteMatch,
  fetcher: ServerFetcher,
  staticLoader?: StaticLoader,
): Promise<StaticLoaderOutput> {
  const id = route.id;
  const input = createStaticLoaderInput(url, route, fetcher);

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

  const output = await staticLoader(input);

  const isDataValid =
    !output ||
    (typeof output === 'object' &&
      (!output.data || typeof output.data === 'object'));

  if (isDataValid && isFunction(output?.cache)) {
    const cacheKey = await output!.cache(input);

    if (cacheKey) {
      const cache = loaderCache.get(id) ?? new Map();
      cache.set(cacheKey, output);
      loaderCache.set(id, cache);
    }

    cacheKeyBuilder.set(id, output!.cache);
  }

  if (!isDataValid) {
    if (!warned.has(id)) {
      logger.warn(
        'Received invalid data from loader (expected object).',
        [
          `\n${kleur.bold('File:')} ${route.id}`,
          `${kleur.bold('Output Type:')} ${typeof output}`,
          `${kleur.bold('Data Type:')} ${typeof output?.data}`,
        ].join('\n'),
        '\n',
      );

      warned.add(id);
    }

    return {};
  }

  if (output?.cache && !isFunction(output.cache)) {
    if (!warned.has(id)) {
      logger.warn(
        'Received invalid cache builder from loader (expected function).',
        [
          `\n${kleur.bold('File:')} ${route.id}`,
          `${kleur.bold('Cache Type:')} ${typeof output.cache}`,
        ].join('\n'),
        '\n',
      );

      warned.add(id);
    }
  }

  warned.delete(id);
  return output ?? {};
}
