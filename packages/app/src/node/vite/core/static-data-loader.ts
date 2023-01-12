import kleur from 'kleur';

import type { App } from 'node/app/App';
import type { RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import { logger } from 'node/utils';
import { handleApiError, handleApiRequest } from 'server';
import { createStaticLoaderInput } from 'server/static-data';
import type {
  MaybeStaticLoaderResponse,
  ServerFetch,
  ServerLoadedPageRoute,
  ServerManifest,
  ServerPageModule,
  ServerRedirect,
  StaticLoader,
  StaticLoaderCacheKeyBuilder,
  StaticLoaderCacheMap,
  StaticLoaderResponse,
} from 'server/types';
import { coerceFetchInput, createVesselResponse, httpError } from 'shared/http';
import {
  getRouteComponentTypes,
  matchAllRoutes,
  matchRoute,
  stripRouteComponentTypes,
  type Route,
  type RouteComponentType,
  type RouteMatch,
} from 'shared/routing';
import type { Mutable } from 'shared/types';
import { isFunction, isString } from 'shared/utils/unit';
import { isLinkExternal, slash } from 'shared/utils/url';

import { getDevServerOrigin } from './dev-server';

// Create fetcher to ensure relative paths work when fetching inside `staticLoader`. Also
// ensures requests are able to load HTTP modules so they can respond because there's no server here.
export function createStaticLoaderFetch(app: App, manifest: ServerManifest): ServerFetch {
  const ssrOrigin = getDevServerOrigin(app);
  const ssrURL = new URL(ssrOrigin);
  return async (input, init) => {
    const request = coerceFetchInput(input, init, ssrURL);

    if (request.URL.origin === ssrOrigin) {
      const route = matchRoute(request.URL, manifest.routes.api);

      if (!route) {
        return handleApiError(request, httpError('route not found', 404), manifest);
      }

      return handleApiRequest(request, route, manifest);
    }

    return createVesselResponse(request.URL, await fetch(request, init)) as any;
  };
}

export type LoadStaticRouteResult = {
  matches: ServerLoadedPageRoute[];
  redirect?: ServerRedirect;
};

const getServerModuleKey = (route: Route & RouteMatch, type: RouteComponentType) =>
  route.id + '#' + type;
const serverModules = new Map<string, ServerPageModule>();

const getStaticDataKey = (url: URL, route: Route & RouteMatch, type: RouteComponentType) =>
  route.id + '#' + type + '#' + url.pathname;
const staticData = new Map<string, MaybeStaticLoaderResponse>();

export async function loadStaticRoute(
  app: App,
  url: URL,
  route: AppRoute,
  serverFetch: ServerFetch,
  load: (route: AppRoute, type: RouteFileType) => Promise<ServerPageModule>,
): Promise<LoadStaticRouteResult> {
  let branch = app.routes.getBranch(route),
    matches = matchAllRoutes(url, branch, app.config.routes.trailingSlash);

  matches = [
    // leaf
    matches[0],
    ...matches.slice(1).map((match) => ({
      ...match,
      // remove pages from branch
      page: undefined,
    })),
  ];

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
                const data = await callStaticLoader(url, match, serverFetch, mod.staticLoader);
                staticData.set(key, data);
              }
            }
          }
        }),
      );
    }),
  );

  const results: ServerLoadedPageRoute[] = [];
  const baseUrl = app.vite.resolved!.base;

  // Go backwards for render order.
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];

    const result: Mutable<ServerLoadedPageRoute> = stripRouteComponentTypes(match);

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
  const status = isString(redirect) ? 307 : redirect.status ?? 307;
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
  serverFetch: ServerFetch,
  staticLoader?: StaticLoader,
): Promise<StaticLoaderResponse> {
  const id = route.id;
  const input = createStaticLoaderInput(url, route, serverFetch);

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

  const response = await staticLoader(input);

  const isDataValid =
    !response ||
    (typeof response === 'object' && (!response.data || typeof response.data === 'object'));

  if (isDataValid && isFunction(response?.cache)) {
    const cacheKey = await response!.cache(input);

    if (cacheKey) {
      const cache = loaderCache.get(id) ?? new Map();
      cache.set(cacheKey, response);
      loaderCache.set(id, cache);
    }

    cacheKeyBuilder.set(id, response!.cache);
  }

  if (!isDataValid) {
    if (!warned.has(id)) {
      logger.warn(
        'Received invalid response from static loader (expected object).',
        [
          `\n${kleur.bold('File:')} ${route.id}`,
          `${kleur.bold('Response Type:')} ${typeof response}`,
          `${kleur.bold('Data Type:')} ${typeof response?.data}`,
        ].join('\n'),
        '\n',
      );

      warned.add(id);
    }

    return {};
  }

  if (response?.cache && !isFunction(response.cache)) {
    if (!warned.has(id)) {
      logger.warn(
        'Received invalid cache builder from loader (expected function).',
        [
          `\n${kleur.bold('File:')} ${route.id}`,
          `${kleur.bold('Cache Type:')} ${typeof response.cache}`,
        ].join('\n'),
        '\n',
      );

      warned.add(id);
    }
  }

  warned.delete(id);
  return response ?? {};
}
