import {
  resolveStaticDataAssetId,
  STATIC_DATA_ASSET_BASE_PATH,
} from 'shared/data';
import {
  HttpError,
  isErrorResponse,
  isExpectedErrorResponse,
  resolveServerResponseData,
} from 'shared/http';
import {
  getRouteComponentTypes,
  LoadedRouteData,
  LoadRouteResult,
  loadRoutes as __loadRoutes,
  resolveSettledPromiseValue,
  RouteComponentType,
} from 'shared/routing';

import type { ClientLoadedRoute, ClientMatchedRoute } from './types';

export type ClientLoadRouteResult = LoadRouteResult<
  ClientMatchedRoute,
  LoadStaticDataResult,
  LoadServerDataResult
>;

const loading = new Map<string, Promise<ClientLoadRouteResult[]>>();

export async function loadRoutes(url: URL, routes: ClientMatchedRoute[]) {
  const id = routes[0].id + routes.length;
  if (loading.has(id)) return loading.get(id)!;

  let resolve!: (route: ClientLoadRouteResult[]) => void;
  const promise = new Promise<ClientLoadRouteResult[]>(
    (res) => (resolve = res),
  );

  loading.set(id, promise);

  const loadResults = await __loadRoutes(
    url,
    routes,
    loadStaticData,
    loadServerData,
  );

  resolve(loadResults);
  loading.delete(id);
  return loadResults;
}

type LoadStaticDataResult =
  | { redirect?: string; data?: LoadedRouteData['staticData'] }
  | undefined;

export async function loadStaticData(
  url: URL,
  route: ClientMatchedRoute,
  type: RouteComponentType,
): Promise<LoadStaticDataResult> {
  const component = route[type];
  if (!component) return;

  if (route.loaded) {
    const loadedRoute = route as ClientLoadedRoute;
    return { data: loadedRoute[type]!.staticData };
  }

  let pathname = url.pathname;
  if (!pathname.endsWith('/')) pathname += '/';

  const id = resolveStaticDataAssetId(route.id, type, pathname),
    dataAssetId = import.meta.env.PROD
      ? window['__VSL_STATIC_DATA_HASH_MAP__'][await hashStaticDataAssetId(id)]
      : id;

  if (!dataAssetId) return;

  const injectedData = getInjectedStaticData(dataAssetId);
  if (injectedData) return { data: injectedData };

  // Unique loading process during dev because we don't know static redirects or which routes
  // have a static loader. This is determined at build time and injected into the HTML document.
  if (import.meta.env.DEV) {
    const queryParams = `?id=${encodeURIComponent(
      route.id,
    )}&type=${type}&pathname=${encodeURIComponent(pathname)}`;

    const response = await fetch(
      `${STATIC_DATA_ASSET_BASE_PATH}/${route.id}.json${queryParams}`,
      { credentials: 'same-origin' },
    );

    const redirect = response.headers.get('X-Vessel-Redirect');
    if (redirect) return { redirect };

    if (response.headers.get('X-Vessel-Data') === 'yes') {
      try {
        return { data: await response.json() };
      } catch (e) {
        if (import.meta.env.DEV) {
          console.log(
            `[vessel] received malformed static JSON data from server.\n\nRoute ID:${route.id}\nURL:${url.href}`,
          );
        }
      }
    }
  } else {
    const response = await fetch(
      `${STATIC_DATA_ASSET_BASE_PATH}/${dataAssetId}.json`,
      { credentials: 'same-origin' },
    );

    if (response.status >= 400) {
      throw new HttpError('failed loading static data', response.status);
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
): Promise<LoadServerDataResult> {
  const component = route[type];

  if (!component || (import.meta.env.PROD && !component.canFetch)) {
    return;
  }

  if (route.loaded) {
    const loadedRoute = route as ClientLoadedRoute;
    return { data: loadedRoute[type]?.serverData };
  }

  url.searchParams.set('route_id', route.id);
  url.searchParams.set('route_type', type);

  const response = await fetch(url.href, { credentials: 'same-origin' });

  const redirect = response.headers.get('X-Vessel-Redirect');
  if (redirect) return { redirect };

  if (isErrorResponse(response)) {
    const data = await response.json();

    if (isExpectedErrorResponse(response)) {
      return {
        error: new HttpError(
          data.error.message,
          response.status,
          data.error.data,
        ),
      };
    }

    const error = Error(data.error.message);
    error.stack = data.error.stack;
    throw error;
  }

  return { data: await resolveServerResponseData(response) };
}

function getInjectedStaticData(id: string) {
  return window['__VSL_STATIC_DATA__']?.[id];
}

// Used in production to hash data id.
async function hashStaticDataAssetId(id: string) {
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
          console.log(
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
