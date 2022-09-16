import { resolveStaticDataAssetId } from 'shared/data';
import { execRouteMatch, type Route } from 'shared/routing';

import type {
  LoadedServerRoute,
  StaticLoaderDataMap,
  StaticLoaderInput,
} from './types';

export function createStaticLoaderInput(
  url: URL,
  route: Route,
): StaticLoaderInput {
  const match = execRouteMatch(url, route)!;
  return {
    pathname: url.pathname,
    route,
    params: match.groups,
  };
}

export function createStaticDataMap(
  route: LoadedServerRoute,
): StaticLoaderDataMap {
  const map: StaticLoaderDataMap = new Map();

  for (const segment of [...route.branch, route]) {
    map.set(
      resolveStaticDataAssetId(segment.id, route.url.pathname),
      segment.staticData ?? {},
    );
  }

  return map;
}

export function createStaticDataScriptTag(map: StaticLoaderDataMap) {
  const table = {};

  for (const id of map.keys()) {
    const data = map.get(id)!;
    if (data && Object.keys(data).length > 0) {
      table[id] = data;
    }
  }

  return [
    '<script>',
    `__VSL_STATIC_DATA__ = JSON.parse(${JSON.stringify(
      JSON.stringify(table),
    )});`,
    '</script>',
  ].join('');
}
