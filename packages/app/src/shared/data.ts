import {
  getRouteComponentTypes,
  type LoadedRoute,
  type RouteComponentType,
} from './routing';

export const STATIC_DATA_ASSET_BASE_PATH = '/_immutable/data';

export function resolveStaticDataAssetId(
  id: string,
  type: RouteComponentType,
  pathname: string,
) {
  return `id=${id}&type=${type}&path=${pathname}`;
}

export function resolveDataAssetIds(routes: LoadedRoute[], pathname: string) {
  const ids = new Set<string>();

  for (const route of routes) {
    for (const type of getRouteComponentTypes()) {
      if (route[type]) {
        ids.add(resolveStaticDataAssetId(route.id, type, pathname));
      }
    }
  }

  return ids;
}
