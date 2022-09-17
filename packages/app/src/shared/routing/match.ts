import { slash } from 'shared/utils/url';

import type { LoadableRoute, MatchedRoute, Route } from './types';

export function filterRoutesByType<T extends LoadableRoute>(
  routes: T[],
  type: Route['type'],
) {
  return routes.filter((route) => route.type === type);
}

export function filterBranchRoutes<T extends LoadableRoute>(routes: T[]) {
  return routes.filter((route) => route.type !== 'page');
}

export function filterRouteSegments<T extends LoadableRoute>(
  url: URL,
  routes: T[],
) {
  if (routes.length === 0) return [];

  const segments: [URL, T][] = [];
  const pathSegments = decodeURI(url.pathname.slice(1)).split('/');

  let pointer = 0;
  for (let i = 1; i <= pathSegments.length; i++) {
    url.pathname = pathSegments.slice(0, i).join('/');

    let index = 0;
    while (index >= 0) {
      index = routes
        .slice(pointer)
        .findIndex(
          (route) =>
            route.type !== 'page' &&
            route.pattern.test({ pathname: url.pathname }),
        );
      if (index >= 0) {
        segments.push([new URL(url), routes[index]]);
        pointer = index;
      }
    }

    if (pointer >= routes.length) break;
  }

  // reverse to ensure correct render order.
  return segments.reverse();
}

export function matchRoute<T extends LoadableRoute>(
  url: URL,
  routes: T[],
): MatchedRoute<T> | null {
  const segments = filterRouteSegments(url, routes);
  if (segments.length === 0) return null;

  let prev: MatchedRoute<T> | undefined;
  for (const [url, route] of segments) {
    const matched = {
      ...createMatchedRoute(url, route),
      branch: prev ? [...prev.branch, prev] : [],
    };

    prev = matched;
  }

  // return the last matched route whose branch contains all segments
  return prev!;
}

export function createMatchedRoute<T extends LoadableRoute>(
  url: URL,
  route: T,
): MatchedRoute<T> {
  const match = execRouteMatch(url, route);
  return {
    ...route,
    url,
    pathId: createPathId(url),
    params: match?.groups ?? {},
    branch: [],
  };
}

export function findRoute<T extends Route>(url: URL, routes: T[]) {
  return routes.find((route) => testRoute(url, route));
}

export function testRoute<T extends Route>(url: URL, route: T) {
  return route.pattern.test({ pathname: url.pathname });
}

export function execRouteMatch<T extends Route>(url: URL, route?: T) {
  return route?.pattern.exec({ pathname: url.pathname })?.pathname;
}

export function normalizeURL(url: URL, trailingSlash = true) {
  url.pathname = url.pathname.replace('/index.html', '/');
  if (!trailingSlash) url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}

export function createPathId(url: URL, baseUrl = '/') {
  const pathname = decodeURI(slash(url.pathname.slice(baseUrl.length)));
  const query = new URLSearchParams(url.search);
  return `${pathname}?${query}`;
}
