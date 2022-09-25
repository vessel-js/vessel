import {
  getRouteComponentTypes,
  type LoadedRoute,
  type MatchedRoute,
  type RouteComponentType,
} from './routing';

export const STATIC_DATA_ASSET_BASE_PATH = '/_immutable/data';

export function resolveStaticDataAssetId(
  route: MatchedRoute,
  type: RouteComponentType,
) {
  return `id=${route.id}&type=${type}&path=${route.matchedURL.pathname}`;
}

export function resolveDataAssetIds(routes: LoadedRoute[]) {
  const ids = new Set<string>();

  for (const route of routes) {
    for (const type of getRouteComponentTypes()) {
      if (route[type]) {
        ids.add(resolveStaticDataAssetId(route, type));
      }
    }
  }

  return ids;
}
