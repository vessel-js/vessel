import {
  resolveStaticDataAssetId,
  STATIC_DATA_ASSET_BASE_PATH,
} from 'shared/data';
import {
  LoadedRouteData,
  loadRoutes as __loadRoutes,
  RouteComponentType,
  RouteLoadResult,
} from 'shared/routing';

import type { ClientMatchedRoute } from './types';

export type LoadRouteResult = RouteLoadResult<
  ClientMatchedRoute,
  StaticDataLoadResult | void,
  ServerDataLoadResult | void
>;

const loading = new Map<string, Promise<LoadRouteResult[]>>();

export async function loadRoutes(url: URL, routes: ClientMatchedRoute[]) {
  const id = routes[0].id + routes.length;
  if (loading.has(id)) return loading.get(id)!;

  let resolve!: (route: LoadRouteResult[]) => void;
  const promise = new Promise<LoadRouteResult[]>((res) => (resolve = res));
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

type StaticDataLoadResult = {
  redirect?: string;
  data?: LoadedRouteData['staticData'];
};

export async function loadStaticData(
  url: URL,
  route: ClientMatchedRoute,
  type: RouteComponentType,
): Promise<StaticDataLoadResult | void> {
  const component = route[type];
  if (!component || type === 'error') return;

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
    );

    return { data: await response.json() };
  }
}

type ServerDataLoadResult = {
  redirect?: string;
  data?: LoadedRouteData['serverData'];
  error?: LoadedRouteData['error'];
};

export async function loadServerData(
  url: URL,
  route: ClientMatchedRoute,
  type: RouteComponentType,
): Promise<ServerDataLoadResult | void> {
  const component = route[type];

  if (!component || (import.meta.env.PROD && !component.canFetch)) {
    return;
  }

  // error? + redirect?
  // qparam => ?__data

  return {};
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
