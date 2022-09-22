import kleur from 'kleur';
import type { App } from 'node/app/App';
import type { RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import { logger } from 'node/utils';
import { createStaticLoaderInput } from 'server';
import type {
  MaybeStaticLoaderOutput,
  ServerLoadedRoute,
  ServerModule,
  ServerRedirect,
  StaticLoader,
  StaticLoaderCacheKeyBuilder,
  StaticLoaderCacheMap,
  StaticLoaderOutput,
} from 'server/types';
import {
  getOrderedRouteComponentTypes,
  getRouteComponentTypes,
  matchAllRoutes,
  type Route,
  type RouteComponentType,
  type RouteMatch,
  stripRouteComponentTypes,
} from 'shared/routing';
import { isFunction, isString } from 'shared/utils/unit';
import { isLinkExternal, slash } from 'shared/utils/url';

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
  route: Route & RouteMatch,
  type: RouteComponentType,
) => route.id + type + route.matchedURL.pathname;
const staticData = new Map<string, MaybeStaticLoaderOutput>();

export async function loadStaticRoute(
  app: App,
  url: URL,
  route: AppRoute,
  load: (route: AppRoute, type: RouteFileType) => Promise<ServerModule>,
): Promise<LoadStaticRouteResult> {
  const branch = app.routes.getBranch(route);
  const matches = matchAllRoutes(url, branch);

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
            const key = getStaticDataKey(match, type);
            if (!staticData.has(key)) {
              const modKey = getServerModuleKey(match, type);
              const mod = serverModules.get(modKey)!;
              staticData.set(
                key,
                await mod.staticLoader?.(
                  createStaticLoaderInput(match.matchedURL, match),
                ),
              );
            }
          }
        }),
      );
    }),
  );

  const results: ServerLoadedRoute[] = [];
  const baseUrl = app.vite.resolved!.base;
  const orderedTypes = getOrderedRouteComponentTypes();

  // Go backwards for render order.
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];

    const result: Writeable<ServerLoadedRoute> =
      stripRouteComponentTypes(match);

    for (const type of orderedTypes) {
      if (match[type]) {
        const mod = serverModules.get(getServerModuleKey(match, type))!;
        const data = staticData.get(getStaticDataKey(match, type));

        if (data?.redirect) {
          return {
            redirect: normalizeRedirectPath(data.redirect, baseUrl),
            matches: [],
          };
        }

        result[type] = {
          module: mod,
          loader: () => Promise.resolve(mod),
          staticData: { ...data },
        };
      }
    }

    results.push(result);
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

export async function callStaticLoader(
  url: URL,
  route: Route,
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

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
