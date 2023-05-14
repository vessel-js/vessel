import {
  getRouteComponentTypes,
  type LoadedRoute,
  type MatchedRoute,
  type RouteComponentType,
} from './routing';

export const STATIC_DATA_ASSET_BASE_PATH = '/_immutable/data';

export function resolveStaticDataAssetId(url: URL, route: MatchedRoute, type: RouteComponentType) {
  return `id=${route.id}&type=${type}&path=${url.pathname}`;
}

export function resolveDataAssetIds(url: URL, routes: LoadedRoute[]) {
  const ids = new Set<string>();

  for (const route of routes) {
    for (const type of getRouteComponentTypes()) {
      if (route[type]) {
        ids.add(resolveStaticDataAssetId(url, route, type));
      }
    }
  }

  return ids;
}
