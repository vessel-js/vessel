import { resolveStaticDataAssetId, STATIC_DATA_ASSET_BASE_PATH } from 'shared/data';
import {
  HttpError,
  resolveResponseData,
  resolveResponseRedirect,
  tryResolveResponseError,
} from 'shared/http';
import {
  loadRoutes as __loadRoutes,
  getRouteComponentTypes,
  resolveSettledPromiseValue,
  type LoadedRouteData,
  type LoadRouteResult,
  type RouteComponentType,
} from 'shared/routing';

import type { ClientLoadedRoute, ClientMatchedRoute } from './types';

export type ClientLoadRouteResult = LoadRouteResult<
  ClientMatchedRoute,
  LoadStaticDataResult,
  LoadServerDataResult
>;

const loading = new Map<string, Promise<ClientLoadRouteResult[]>>();

export async function loadRoutes(url: URL, routes: ClientMatchedRoute[], signal?: AbortSignal) {
  const id = routes[0].id + routes[0].pathname;
  if (loading.has(id)) return loading.get(id)!;

  let resolve!: (route: ClientLoadRouteResult[]) => void;
  const promise = new Promise<ClientLoadRouteResult[]>((res) => (resolve = res));

  loading.set(id, promise);

  const loadResults = await __loadRoutes(url, routes, loadStaticData, loadServerData, signal);

  resolve(loadResults);
  loading.delete(id);
  return loadResults;
}

type LoadStaticDataResult = { redirect?: string; data?: LoadedRouteData['staticData'] } | undefined;

export async function loadStaticData(
  url: URL,
  route: ClientMatchedRoute,
  type: RouteComponentType,
  signal?: AbortSignal,
): Promise<LoadStaticDataResult> {
  const component = route[type];
  if (!component) return;

  // Avoid undefined.
  if (component.stale === false) {
    const loadedRoute = route as ClientLoadedRoute;
    return { data: loadedRoute[type]!.staticData };
  }

  const dataId = resolveStaticDataAssetId(route, type);

  const hashedDataId = import.meta.env.PROD
    ? window['__VSL_STATIC_DATA_HASH_MAP__']?.[await hash(dataId)]
    : dataId;

  if (!hashedDataId) return;

  if (!window['__VSL_ROUTER_STARTED__']) {
    const data = window['__VSL_STATIC_DATA__']?.[hashedDataId];
    if (data) return { data };
  }

  // Unique loading process during dev because we don't know static redirects or which routes
  // have a static loader. This is determined at build time and injected into the HTML document.
  if (import.meta.env.DEV) {
    const searchParams = new URLSearchParams();
    searchParams.set('id', route.id);
    searchParams.set('type', type);
    searchParams.set('pathname', route.matchedURL.pathname);

    const response = await fetch(`${STATIC_DATA_ASSET_BASE_PATH}${route.id}.json?${searchParams}`, {
      credentials: 'same-origin',
      signal,
    });

    if (response.status === 500) {
      const { message, stack } = await response.json();
      const error = new Error(message);
      error.stack = stack;
      throw error;
    }

    const redirect = response.headers.get('X-Vessel-Redirect');
    if (redirect) return { redirect };

    if (response.headers.get('X-Vessel-Data') === 'yes') {
      try {
        return { data: await response.json() };
      } catch (e) {
        console.error(
          `[vessel] received malformed static JSON data from server.\n\nRoute ID:${route.id}\nURL:${url.href}`,
        );
      }
    }
  } else {
    const response = await fetch(`${STATIC_DATA_ASSET_BASE_PATH}/${hashedDataId}.json`, {
      credentials: 'same-origin',
      signal,
    });

    if (response.status >= 400) {
      throw new HttpError('failed static data load', response.status);
    }

    return { data: await response.json() };
  }

  return; // TS being silly
}

type LoadServerDataResult =
  | {
      redirect?: string;
      data?: LoadedRouteData['serverData'];
      error?: LoadedRouteData['serverLoadError'];
    }
  | undefined;

export async function loadServerData(
  url: URL,
  route: ClientMatchedRoute,
  type: RouteComponentType,
  signal?: AbortSignal,
): Promise<LoadServerDataResult> {
  const component = route[type];

  if (!component || (import.meta.env.PROD && !component.canFetch)) {
    return;
  }

  if (!window['__VSL_ROUTER_STARTED__']) {
    const id = route.id + '~' + type;
    const res = window['__VSL_SERVER_DATA__']?.[id];
    const error = res?.error;
    if (error) {
      if (error.expected) {
        return {
          error: new HttpError(error.message, error.status, error.data),
        };
      } else {
        const err = new Error(error.message);
        if (import.meta.env.DEV) err.stack = error.stack;
        throw err;
      }
    } else if (res?.data) {
      return { data: res.data };
    }
  }

  if (component.stale === false) {
    const loadedRoute = route as ClientLoadedRoute;
    return { data: loadedRoute[type]?.serverData };
  }

  const dataURL = new URL(route.matchedURL.href);
  dataURL.searchParams.set('__data', '');
  dataURL.searchParams.set('route_id', route.id);
  dataURL.searchParams.set('route_type', type);

  const response = await fetch(dataURL, {
    credentials: 'same-origin',
    signal,
  });

  if (response.headers.get('X-Vessel-Data') === 'no') return;

  const redirect = resolveResponseRedirect(response);
  if (redirect) return { redirect };

  const error = await tryResolveResponseError(response);
  if (error) return { error };

  return { data: await resolveResponseData(response) };
}

// Used in production to hash data id.
async function hash(id: string) {
  const encodedText = new TextEncoder().encode(id);
  const hashBuffer = await crypto.subtle.digest('SHA-1', encodedText);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 8);
}

export function checkForLoadedRedirect(route: ClientLoadRouteResult) {
  // In production, we don't have to check build-time redirects (`staticData`) because the
  // redirect table is injected into the HTML document for a static site, or injected into the
  // network route table for a provider.
  if (import.meta.env.DEV) {
    const dataTypes = ['staticData', 'serverData'] as const;
    for (const type of getRouteComponentTypes()) {
      for (const dataType of dataTypes) {
        const value = resolveSettledPromiseValue(route[type]?.[dataType]);
        if (value?.redirect) {
          console.debug(
            [
              `[vessel] data requested a redirect`,
              `\nRoute ID: \`${route.id}\``,
              `Route Type: \`${type}\``,
              `Data Type: \`${dataType}\``,
            ].join('\n'),
          );

          return value.redirect;
        }
      }
    }
  } else {
    for (const type of getRouteComponentTypes()) {
      const value = resolveSettledPromiseValue(route[type]?.serverData);
      if (value?.redirect) return value.redirect;
    }
  }

  return null;
}
