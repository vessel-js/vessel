import path from 'node:path';
import { calcRoutePathScore, type Route } from 'shared/routing';
import { isFunction } from 'shared/utils/unit';
import { endslash, slash } from 'shared/utils/url';

import type { RouteMatcher, RouteMatcherConfig } from '../config';

const PAGE_ORDER_RE = /^\[(\d+)\]/;

const STRIP_PAGE_ORDER_RE = /\/\[(\d+)\]/g;
const STRIP_ROUTE_GROUPS_RE = /\/\(.*?\)\//g;

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

export function resolveRouteFromFilePath(
  id: string,
  type: Route['type'],
  routePath: string,
  matchers: RouteMatcherConfig = [],
): Route {
  const basename = path.posix.basename(routePath);
  const orderMatch = basename.match(PAGE_ORDER_RE)?.[1];
  const order = orderMatch ? Number(orderMatch) : undefined;
  const { pathname, dynamic, score } = resolveRouteInfoFromFilePath(
    type,
    routePath,
    matchers,
  );
  const pattern = new URLPattern({ pathname });
  return {
    id,
    type,
    pathname,
    pattern,
    dynamic,
    order,
    score,
  };
}

export function resolveRouteInfoFromFilePath(
  type: Route['type'],
  routePath: string,
  matchers: RouteMatcherConfig = [],
) {
  const isHttp = type === 'http';

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

  const resolveStaticPath = () => {
    const url = new URL(route.toLowerCase(), 'http://v/');
    return `${url.pathname === '/' ? '' : url.pathname}{/}?{index}?{.html}?`;
  };

  const dynamic = /\/\[.*?\](\/|$)/.test(routePath);

  const pathname =
    dynamic || isHttp
      ? slash(`${route}${isHttp ? '{/}?' : '{/}?{index}?{.html}?'}`)
      : resolveStaticPath();

  const score = calcRoutePathScore(pathname);

  return { pathname, dynamic, score };
}

export function resolveStaticRouteFromFilePath(
  routesDir: string,
  filePath: string,
) {
  const routePath = endslash(path.posix.relative(routesDir, filePath));

  const url = new URL(
    stripRouteMeta(routePath).toLowerCase(),
    'http://localhost',
  );

  return url.pathname
    .replace(/\..+($|\\?)/i, '.html')
    .replace(/\/(README|index).html($|\\?)/i, '/');
}
