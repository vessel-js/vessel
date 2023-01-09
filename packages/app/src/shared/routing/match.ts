import { endslash, noendslash } from 'shared/utils/url';

import type { Route, RouteComponentType, RouteMatch } from './types';

export function matchRoute<T extends Route>(url: URL, routes: T[]) {
  const route = routes.find((route) => testRoute(url, route));
  return route ? createMatchedRoute(url, route) : null;
}

export function matchAllRoutes<T extends Route>(
  url: URL,
  routes: T[],
  trailingSlash = false,
): (RouteMatch & T)[] {
  const segments = filterMatchingRouteSegments(url, routes, trailingSlash);
  return segments.map(([url, route]) => createMatchedRoute(url, route));
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

export function filterMatchingRouteSegments<T extends Route>(
  url: URL,
  routes: T[],
  trailingSlash = false,
) {
  if (routes.length === 0) return [];

  const segments: [url: URL, route: T][] = [];
  const pathSegments = decodeURI(url.pathname).slice(1).split('/');

  let start = 0;
  for (let i = pathSegments.length; i >= 0; i--) {
    const segment = pathSegments.slice(0, i).join('/');

    const segmentURL = new URL(
      segment === '' ? '/' : `/${segment}${trailingSlash ? '/' : ''}`,
      url,
    );

    const match = routes
      .slice(start)
      .findIndex(
        (route) =>
          testRoute(segmentURL, route) && (!segments[0] || segments[0][1].id.startsWith(route.id)),
      );

    if (match >= 0) {
      segments.push([segmentURL, routes[start + match]]);
      start = match + 1;
    }
  }

  return segments;
}
