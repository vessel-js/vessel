// eslint-disable-next-line import/no-named-as-default
import Table from 'cli-table3';
import { gzipSizeSync } from 'gzip-size';
import kleur from 'kleur';
import type { App, AppRoute, RoutesLoggerInput } from 'node';
import { comparePathDepth, LoggerIcon } from 'node/utils';
import prettyBytes from 'pretty-bytes';
import type { OutputChunk } from 'rollup';
import { noslash, slash } from 'shared/utils/url';

import type { BuildBundles, BuildData } from './build-data';
import { resolveHttpChunkMethods } from './chunks';

type RouteType = 'static' | 'server' | 'api' | 'redirect' | 'invalid';

const METHOD_COLOR = {
  ANY: kleur.white,
  GET: kleur.green,
  POST: kleur.magenta,
  PUT: kleur.cyan,
  PATCH: kleur.yellow,
  DELETE: kleur.red,
};

const TYPE_COLOR = {
  STATIC: kleur.dim,
  SERVER: kleur.magenta,
  EDGE: kleur.cyan,
  API: kleur.white,
  REDIRECT: kleur.yellow,
  INVALID: kleur.red,
};

export function logRoutesTable({ build, bundles }: RoutesLoggerInput) {
  console.log(kleur.magenta('\n+ routes\n'));

  const routes = new Map<
    string,
    {
      type: RouteType;
      edge?: boolean;
      route?: AppRoute;
      redirect?: { to: string; status: number };
    }
  >();

  for (const [link, route] of build.links) {
    routes.set(slash(link), { type: 'static', route });
  }

  for (const [link, info] of build.badLinks) {
    if (info.route) {
      routes.set(slash(link), { type: 'invalid', route: info.route });
    }
  }

  for (const route of build.server.routes) {
    routes.set(slash(route.id), { type: 'server', route });
  }

  for (const [link, redirect] of build.static.redirects) {
    routes.set(slash(link), {
      type: 'redirect',
      redirect: {
        to: redirect.to,
        status: redirect.status,
      },
    });
  }

  const headings = ['METHOD', 'URI', 'TYPE', 'SIZE'];

  const hasEdgeRoutes = build.edge.routes.size > 0;
  if (hasEdgeRoutes) headings.push('EDGE');

  const table = new Table({
    head: headings.map((title) => kleur.bold(title)),
    wordWrap: true,
    colAligns: ['center', 'left', 'center', 'center', 'center'],
    style: { compact: true },
  });

  const links = Array.from(routes.keys())
    .sort(naturalCompare)
    .sort(comparePathDepth);

  const httpLinks: string[] = [];
  for (const route of build.server.endpoints) {
    const id = slash(route.id);
    routes.set(id, { type: 'api', route });
    httpLinks.push(id);
  }

  links.push(...httpLinks.sort(naturalCompare).sort(comparePathDepth));

  for (const id of links) {
    const { type, route, redirect } = routes.get(id)!;

    const uri = id === '/' ? id : noslash(id);
    const edge = route && build.edge.routes.has(route.id);
    const methods =
      route && type === 'api' ? resolveHttpChunkMethods(route, build) : ['GET'];
    const size =
      route && type !== 'api' ? computeRouteSize(route, build, bundles) : ``;

    const typeColor = TYPE_COLOR[type.toUpperCase()];
    const typeTitle = redirect ? `${redirect.status}` : type.toLowerCase();

    for (const method of methods) {
      const methodColor = METHOD_COLOR[method];

      const row = [
        kleur.bold(methodColor(method)),
        uri.replace(/(\[.*?\])/g, (g) => kleur.bold(kleur.yellow(g))),
        typeColor(typeTitle),
        typeof size === 'number' ? prettySize(size) : '',
      ];

      if (hasEdgeRoutes) row.push(edge ? '✅' : '');

      table.push(row);
    }
  }

  console.log(table.toString());
}

export function logRoutes(app: App, build: BuildData, bundles: BuildBundles) {
  const style = app.config.routes.log;
  if (style !== 'none') {
    const logger = style === 'table' ? logRoutesTable : style;
    logger({ build, bundles });
  }
}

export function logBadLinks(badLinks: BuildData['badLinks']) {
  if (badLinks.size === 0) return;

  const logs: string[] = [
    '',
    `${LoggerIcon.Warn} ${kleur.bold(kleur.underline('BAD LINKS'))}`,
    '',
  ];

  for (const [pathname, { route, reason }] of badLinks) {
    logs.push(`- ${kleur.bold(pathname)}`);
    logs.push(`  - Reason: ${reason}`);
    if (route?.page) logs.push(`  - Location: ${route.page.path.root}`);
  }

  console.log(logs.join('\n'));
}

export function computeRouteSize(
  route: AppRoute,
  build: BuildData,
  bundles: BuildBundles,
) {
  const chunks: OutputChunk[] = [];

  const entries = [
    ...build.resources.entry,
    ...build.resources.app,
    ...(build.resources.routes[route.id] ?? []),
  ];

  const seen = new Set<number>();

  for (const entry of entries) {
    if (entry >= 0 && !seen.has(entry)) {
      const resource = build.resources.all[entry];
      const fileName = resource.href.slice(1);
      const chunk = bundles.client.chunks.find(
        (chunk) => chunk.fileName === fileName,
      );
      if (chunk) chunks.push(chunk);
      seen.add(entry);
    }
  }

  let size = 0;
  for (const chunk of chunks) {
    size += gzipSizeSync(chunk.code);
  }

  return size;
}

// Taken from Next.js
const prettySize = (size: number): string => {
  const _size = prettyBytes(size);
  // green for 0-130kb
  if (size < 130 * 1000) return kleur.green(_size);
  // yellow for 130-170kb
  if (size < 170 * 1000) return kleur.yellow(_size);
  // red for >= 170kb
  return kleur.bold(kleur.red(_size));
};

// From: https://github.com/litejs/natural-compare-lite
function naturalCompare(a: string, b: string) {
  let i,
    codeA,
    codeB = 1,
    posA = 0,
    posB = 0;

  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  function getCode(str: any, pos?: any, code?: any) {
    if (code) {
      for (i = pos; (code = getCode(str, i)), code < 76 && code > 65; ) ++i;
      return +str.slice(pos - 1, i);
    }
    code = alphabet && alphabet.indexOf(str.charAt(pos));
    return code > -1
      ? code + 76
      : ((code = str.charCodeAt(pos) || 0), code < 45 || code > 127)
      ? code
      : code < 46
      ? 65 // -
      : code < 48
      ? code - 1
      : code < 58
      ? code + 18 // 0-9
      : code < 65
      ? code - 11
      : code < 91
      ? code + 11 // A-Z
      : code < 97
      ? code - 37
      : code < 123
      ? code + 5 // a-z
      : code - 63;
  }

  if ((a += '') != (b += ''))
    for (; codeB; ) {
      codeA = getCode(a, posA++);
      codeB = getCode(b, posB++);

      if (codeA < 76 && codeB < 76 && codeA > 66 && codeB > 66) {
        codeA = getCode(a, posA, posA);
        codeB = getCode(b, posB, (posA = i));
        posB = i;
      }

      if (codeA != codeB) return codeA < codeB ? -1 : 1;
    }

  return 0;
}
