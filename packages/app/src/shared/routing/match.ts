import { endslash, noendslash } from 'shared/utils/url';

import type { Route, RouteComponentType, RouteMatch } from './types';

export function matchRoute<T extends Route>(url: URL, routes: T[]): (T & RouteMatch) | null {
  const route = routes.find((route) => testRoute(url, route));
  return route ? createMatchedRoute(url, route) : null;
}

export function matchAllRoutes<T extends Route>(
  url: URL,
  routes: T[],
  trailingSlash = false,
): (RouteMatch & T)[] {
  const leaf = routes.find((route) => route.leaf && testRoute(url, route));
  return leaf
    ? matchSegments(url, leaf, routes, trailingSlash).map(([url, route]) =>
        createMatchedRoute(url, route),
      )
    : [];
}

export function createMatchedRoute<T extends Route>(url: URL, route: T): T & RouteMatch {
  const match = execRouteMatch(url, route);
  return {
    ...route,
    matchedURL: url,
    params: match?.groups ?? {},
  };
}

const routeTypes = ['layout', 'errorBoundary', 'page'] as const;
export function getRouteComponentTypes(): readonly RouteComponentType[] {
  return routeTypes;
}

const componentDataKeys = ['module', 'staticData', 'serverData'] as const;
export function getRouteComponentDataKeys() {
  return componentDataKeys;
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

export function normalizeTrailingSlash(pathname: string, trailingSlash: boolean) {
  return pathname === '/' ? pathname : trailingSlash ? endslash(pathname) : noendslash(pathname);
}

export function normalizeURL(url: URL, trailingSlash: boolean) {
  url.pathname = url.pathname.replace('/index.html', '/');
  url.pathname = normalizeTrailingSlash(url.pathname, trailingSlash);
  return url;
}

// type helper
export function stripRouteComponentTypes<T extends Route>(route: T): Omit<T, RouteComponentType> {
  return { ...route };
}

export function matchSegments<T extends Route>(
  url: URL,
  leaf: T,
  routes: T[],
  trailingSlash = false,
) {
  const leafIndex = routes.indexOf(leaf),
    seen = new Set<T>([leaf]),
    matches: [url: URL, route: T][] = [[url, leaf]],
    segments = decodeURI(url.pathname).slice(1).split('/');

  // search backwards for possible parent routes (this can happen with dynamic).
  for (let i = leafIndex - 1; i >= 0; i--) {
    const route = routes[i];
    if (!leaf.id.startsWith(route.id)) break;
    else if (!route.leaf) matches.push([url, route]);
  }

  let start = leafIndex + 1;

  for (let i = segments.length; i >= 0; i--) {
    if (start >= routes.length) break;

    const segment = segments.slice(0, i).join('/');

    const segmentURL = new URL(
      segment === '' ? '/' : `/${segment}${trailingSlash ? '/' : ''}`,
      url,
    );

    for (let j = start; j < routes.length; j++) {
      const route = routes[j];
      if (leaf.id.startsWith(route.id) && !seen.has(route) && testRoute(segmentURL, route)) {
        seen.add(route);
        matches.push([segmentURL, route]);
        if (!route.dynamic) start = j + 1;
      }
    }
  }

  return matches;
}
