import { slash } from 'shared/utils/url';

import type { Route, RouteComponentType, RouteMatch } from './types';

export function matchRoute<T extends Route>(url: URL, routes: T[]) {
  const route = routes.find((route) => testRoute(url, route));
  return route ? createMatchedRoute(url, route) : null;
}

export function matchAllRoutes<T extends Route>(
  url: URL,
  routes: T[],
): (RouteMatch & T)[] {
  const segments = filterMatchingRouteSegments(url, routes);
  return segments.map(([url, route]) => createMatchedRoute(url, route));
}

export function createMatchedRoute<T extends Route>(
  url: URL,
  route: T,
): T & RouteMatch {
  const match = execRouteMatch(url, route);
  return {
    ...route,
    url,
    pathId: createPathId(url),
    params: match?.groups ?? {},
  };
}

// don't mess with this order -> reverse is top-down render order
const routeTypes = ['page', 'errorBoundary', 'layout'] as const;
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

export function stripRouteComponentTypes<T extends Route>(
  route: T,
): Omit<T, RouteComponentType> {
  return getRouteComponentTypes().reduce(
    (p, type) => ({ ...p, [type]: undefined }),
    route,
  );
}

export function filterMatchingRouteSegments<T extends Route>(
  url: URL,
  routes: T[],
) {
  if (routes.length === 0) return [];

  const segments: [url: URL, route: T][] = [];
  const pathSegments = decodeURI(url.pathname).slice(1).split('/');

  let start = 0;
  for (let i = pathSegments.length; i >= 0; i--) {
    const segment = pathSegments.slice(0, i).join('/');
    const segmentURL = new URL(segment === '' ? '/' : `/${segment}/`, url);

    const match = routes.slice(start).findIndex(
      (route) =>
        testRoute(segmentURL, route) &&
        // TODO: hacky fix right now to ensure FS hierarchy holds. Dynamic routes are matching
        // which we probably don't want.
        (!segments[0] || segments[0][1].id.startsWith(route.id)),
    );

    if (match >= 0) {
      segments.push([segmentURL, routes[start + match]]);
      start = match + 1;
    }
  }

  return segments;
}
