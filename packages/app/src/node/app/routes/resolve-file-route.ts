import * as path from 'pathe';
import { calcRoutePathScore, type Route } from 'shared/routing';
import { isFunction } from 'shared/utils/unit';
import { endslash, slash } from 'shared/utils/url';

import type { RouteMatcher, RouteMatcherConfig } from '../config';

const STRIP_PAGE_ORDER_RE = /\/\[(\d+)\]/g;
export function stripRouteOrder(filePath: string) {
  return filePath.replace(STRIP_PAGE_ORDER_RE, '/');
}

function calcPageOrderScore(filePath: string): number {
  let score = 1;

  for (const matches of filePath.matchAll(STRIP_PAGE_ORDER_RE) ?? []) {
    score *= Number(matches[1]);
  }

  return score;
}

export function sortOrderedPageFiles(files: string[]): string[] {
  return files
    .map(slash)
    .sort(
      (fileA, fileB) => calcPageOrderScore(fileA) - calcPageOrderScore(fileB),
    )
    .map(stripRouteOrder);
}

const STRIP_ROUTE_GROUPS_RE = /\/\(.*?\)\//g;
export function stripRouteGroups(filePath: string) {
  return filePath.replace(STRIP_ROUTE_GROUPS_RE, '');
}

export function stripRouteMeta(dirname: string) {
  return stripRouteGroups(stripRouteOrder(dirname));
}

function normalizeTransformMatcher(value: RouteMatcher) {
  if (value instanceof RegExp) {
    const regexStr = value.toString();
    value = regexStr.startsWith('/(')
      ? regexStr.slice(1, -1)
      : `(${regexStr.slice(1, -1)})`;
  }

  return value ?? '';
}

const PAGE_ORDER_RE = /^\[(\d+)\]/;
export function resolveRouteFromFilePath(
  routePath: string,
  matchers: RouteMatcherConfig = [],
  isDocument = true,
): Route {
  const basename = path.basename(routePath);
  const orderMatch = basename.match(PAGE_ORDER_RE)?.[1];
  const order = orderMatch ? Number(orderMatch) : undefined;
  const { pathname, dynamic, score } = resolveRouteInfoFromFilePath(
    routePath,
    matchers,
    isDocument,
  );
  const pattern = new URLPattern({ pathname });
  return {
    id: routePath === '.' ? '/' : `/${routePath}`,
    pathname,
    pattern,
    dynamic,
    order,
    score,
  };
}

export function resolveRouteInfoFromFilePath(
  routePath: string,
  matchers: RouteMatcherConfig = [],
  isDocument = true,
) {
  let route = routePath === '.' ? '/' : stripRouteMeta(routePath);

  for (const matcher of matchers) {
    if (isFunction(matcher)) {
      const result = matcher(route, { path: routePath });
      if (result) route = result;
    } else {
      route = route.replace(
        `[${matcher.name}]`,
        normalizeTransformMatcher(matcher.matcher),
      );
    }
  }

  const resolveStaticPathname = () => {
    const url = new URL(route.toLowerCase(), 'http://v/');
    return `${url.pathname === '/' ? '' : url.pathname}{/}?{index}?{.html}?`;
  };

  const dynamic = /\/\[.*?\](\/|$)/.test(routePath);

  const pathname = dynamic
    ? slash(`${route}${!isDocument ? '{/}?' : '{/}?{index}?{.html}?'}`)
    : resolveStaticPathname();

  const score = calcRoutePathScore(pathname);
  return { pathname, dynamic, score };
}

export function resolveStaticRouteFromFilePath(
  routesDir: string,
  filePath: string,
) {
  const routePath = endslash(path.dirname(path.relative(routesDir, filePath)));

  const url = new URL(
    stripRouteMeta(routePath).toLowerCase(),
    'http://localhost',
  );

  return url.pathname;
}
