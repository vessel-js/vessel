import * as path from 'pathe';

import { trimExt } from 'node/utils';
import { calcRoutePathScore, type Route } from 'shared/routing';
import { isFunction } from 'shared/utils/unit';
import { slash } from 'shared/utils/url';

import type { RouteMatcher, RouteMatcherConfig } from '../config';

const PARAM_ARGS_RE = /\/\[(\w*?)=(.*?)\]/g;
const STRIP_ROUTE_ORDER_RE = /\/\[(\d+)\]/g;
const STRIP_ROUTE_GROUPS_RE = /\/\(.*?\)/g;

export function stripRouteOrder(filePath: string) {
  return filePath.replace(STRIP_ROUTE_ORDER_RE, '/');
}

export function stripRouteGroups(filePath: string) {
  return filePath.replace(STRIP_ROUTE_GROUPS_RE, '');
}

export function stripRouteMeta(dirname: string) {
  return stripRouteGroups(stripRouteOrder(dirname));
}

// /name.ts, /[name].ts, /[[name]].ts ,/[...name].ts, /[[...name]].ts
const namedPageRE = /(\[?\[?\.?\.?\.?\w.*?\]?\]?)\./;

export function resolveRouteIdFromFilePath(appDir: string, filePath: string) {
  const basename = path.basename(filePath);
  const isNamed = /\.(page|api)/.test(basename);

  const id = isNamed
    ? path
        .relative(appDir, filePath)
        .replace(basename, basename.match(namedPageRE)![1] + path.extname(basename))
    : path.dirname(path.relative(appDir, filePath));

  return stripRouteOrder(id === '.' ? '/' : `/${id}`) || '/';
}

export function resolveRouteFromFilePath(
  appDir: string,
  filePath: string,
  matchers: RouteMatcherConfig = [],
): Route {
  let id = resolveRouteIdFromFilePath(appDir, filePath);
  const { pathname, dynamic, score } = resolveRouteMetaFromFilePath(id, matchers);
  const pattern = new URLPattern({ pathname });
  return { id, pathname, pattern, dynamic, score };
}

function resolveRouteMetaFromFilePath(routeId: string, matchers: RouteMatcherConfig = []) {
  let route = stripRouteGroups(trimExt(routeId)) || '/';

  const paramArgs = route.matchAll(PARAM_ARGS_RE);
  for (const arg of paramArgs) {
    const [_, name, value] = arg;
    if (name && value) route = route.replace(`[${name}]`, value);
  }

  route = route.replace(PARAM_ARGS_RE, '');

  for (const matcher of matchers) {
    if (isFunction(matcher)) {
      const result = matcher(route, { path: routeId });
      if (result) route = result;
    } else {
      route = route.replace(`[${matcher.name}]`, normalizeTransformMatcher(matcher.matcher));
    }
  }

  const resolveStaticPathname = () => {
    const url = new URL(route.toLowerCase(), 'http://v/');
    return `${url.pathname === '/' ? '' : url.pathname}{/}?{index}?{.html}?`;
  };

  const dynamic = /\/\[.*?\](\/|$|\.)/.test(routeId);

  const pathname = dynamic ? slash(`${route}${'{/}?{index}?{.html}?'}`) : resolveStaticPathname();

  const score = calcRoutePathScore(pathname);

  return { dynamic, pathname, score };
}

export function resolveStaticRouteFromFilePath(appDir: string, filePath: string) {
  const id = resolveRouteIdFromFilePath(appDir, filePath);
  const url = new URL(trimExt(id), 'http://localhost');
  return url.pathname;
}

function normalizeTransformMatcher(value: RouteMatcher) {
  if (value instanceof RegExp) {
    const regexStr = value.toString();
    value = regexStr.startsWith('/(') ? regexStr.slice(1, -1) : `(${regexStr.slice(1, -1)})`;
  }

  return value ?? '';
}

export function sortOrderedPageFiles(files: string[]): string[] {
  return files
    .map(slash)
    .sort((fileA, fileB) => calcPageOrderScore(fileA) - calcPageOrderScore(fileB))
    .map(stripRouteOrder);
}

function calcPageOrderScore(filePath: string): number {
  let score = 1;

  for (const matches of filePath.matchAll(STRIP_ROUTE_ORDER_RE) ?? []) {
    score *= Number(matches[1]);
  }

  return score;
}
