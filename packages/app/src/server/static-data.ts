import { resolveStaticDataAssetId } from 'shared/data';
import { type JSONData } from 'shared/http';
import { getRouteComponentTypes, type MatchedRoute } from 'shared/routing';

import type {
  ServerFetch,
  ServerLoadedPageRoute,
  StaticLoaderDataMap,
  StaticLoaderEvent,
} from './types';

export function createStaticLoaderInput(
  url: URL,
  route: MatchedRoute,
  serverFetch: ServerFetch,
): StaticLoaderEvent {
  return {
    url,
    pathname: url.pathname,
    route,
    params: route.params,
    serverFetch,
  };
}

export function createStaticLoaderDataMap(routes: ServerLoadedPageRoute[]): StaticLoaderDataMap {
  const map: StaticLoaderDataMap = new Map();

  for (const route of routes) {
    for (const type of getRouteComponentTypes()) {
      const component = route[type];
      if (component) {
        const id = resolveStaticDataAssetId(route, type);
        if (component.staticData) {
          map.set(id, component.staticData);
        }
      }
    }
  }

  return map;
}

export function createStaticDataScriptTag(
  map: StaticLoaderDataMap,
  hashRecord: Record<string, string>,
) {
  const table: Record<string, JSONData> = {};

  for (const id of map.keys()) {
    const data = map.get(id)!;
    if (data && Object.keys(data).length > 0) {
      table[hashRecord[id] ?? id] = data;
    }
  }

  return [
    '<script>',
    `__VSL_STATIC_DATA__ = JSON.parse(${JSON.stringify(JSON.stringify(table))});`,
    '</script>',
  ].join('');
}
