import { LoadedRoute } from './routing';

export const STATIC_DATA_ASSET_BASE_PATH = '/_immutable/data';

export function resolveStaticDataAssetId(id: string, pathname: string) {
  return `id=${id}&path=${pathname}`;
}

export function resolveDataAssetIds(route: LoadedRoute, pathname: string) {
  const ids = new Set<string>();

  for (const segment of [...route.branch, route]) {
    ids.add(resolveStaticDataAssetId(segment.id, pathname));
  }

  return ids;
}
