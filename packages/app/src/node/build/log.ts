// eslint-disable-next-line import/no-named-as-default
import Table from 'cli-table3';
import { gzipSizeSync } from 'gzip-size';
import kleur from 'kleur';
import type { App, RoutesLoggerInput } from 'node';
import { comparePathDepth, LoggerIcon } from 'node/utils';
import prettyBytes from 'pretty-bytes';
import type { OutputChunk } from 'rollup';
import type { ServerConfig } from 'server/http/app/configure-server';
import type { Route } from 'shared/routing/types';
import { noslash, slash } from 'shared/utils/url';

import type { BuildBundles, BuildData } from './build-data';

type RouteType = 'static' | 'lambda' | 'edge' | 'redirect' | 'invalid';

type RoutesMap = Map<
  string,
  {
    pathname?: string;
    type: RouteType;
    methods?: string[];
    redirect?: { to: string; status: number };
  }
>;

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
  LAMBDA: kleur.magenta,
  EDGE: kleur.cyan,
  API: kleur.white,
  REDIRECT: kleur.yellow,
  INVALID: kleur.red,
};

export async function logRoutesTable(
  app: App,
  { build, bundles }: RoutesLoggerInput,
) {
  console.log(kleur.magenta('\n+ routes\n'));

  const documentRoutes: RoutesMap = new Map();
  const apiRoutes: RoutesMap = new Map();

  for (const [link, route] of build.links) {
    documentRoutes.set(slash(link), {
      pathname: route.id,
      type: 'static',
    });
  }

  for (const [link, info] of build.badLinks) {
    if (info.route) {
      documentRoutes.set(slash(link), {
        pathname: info.route.id,
        type: 'invalid',
      });
    }
  }

  for (const route of build.server.routes) {
    documentRoutes.set(slash(route.id), {
      pathname: route.id,
      type: build.edge.routes.has(route.id) ? 'edge' : 'lambda',
    });
  }

  for (const [link, redirect] of build.static.redirects) {
    documentRoutes.set(slash(link), {
      type: 'redirect',
      redirect: {
        to: redirect.to,
        status: redirect.status,
      },
    });
  }

  const apiLinks: string[] = [];
  const httpRoutes: Omit<Route, 'pattern'>[] = [...build.server.endpoints];
  const httpMethods = new Map<string, string[]>();
  const edgeRoutes = new Set<string>(build.edge.routes);

  await Promise.all(
    Object.keys(build.server.configChunks).map(async (type) => {
      const chunk = build.server.configChunks[type];
      if (chunk) {
        const mod = (await import(app.dirs.server.resolve(chunk.fileName))) as {
          default: ServerConfig;
        };

        const { httpRoutes: routes } = mod.default;
        const isEdge = type === 'edge';

        for (const route of routes) {
          httpRoutes.push(route);
          if (isEdge) edgeRoutes.add(route.id);
        }
      }
    }),
  );

  for (const route of httpRoutes) {
    const type = edgeRoutes.has(route.id) ? 'edge' : 'lambda';
    const id = route.id + type;
    if (!apiRoutes.has(id)) {
      apiLinks.push(id);
      apiRoutes.set(id, {
        pathname: route.pathname,
        type,
        methods: httpMethods.get(route.id),
      });
    }
  }

  // Document
  const documentTable = createRoutesTable({ sizes: true });

  const documentLinks = Array.from(documentRoutes.keys())
    .sort(naturalCompare)
    .sort(comparePathDepth);

  addRoutesToTable(
    documentTable,
    documentLinks,
    documentRoutes,
    {
      build,
      bundles,
    },
    { sizes: true },
  );

  // API
  const apiTable = createRoutesTable();

  addRoutesToTable(
    apiTable,
    apiLinks.sort(naturalCompare).sort(comparePathDepth),
    apiRoutes,
    { build, bundles },
  );

  // LOG

  console.log(kleur.bold('DOCUMENT'));
  console.log(documentTable.toString());

  console.log(kleur.bold('\nAPI'));
  console.log(apiTable.toString());
}

export async function logRoutes(
  app: App,
  build: BuildData,
  bundles: BuildBundles,
) {
  const style = app.config.routes.log;
  if (style !== 'none') {
    const logger = style === 'table' ? logRoutesTable : style;
    await logger(app, { build, bundles });
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

function createRoutesTable(options: { sizes?: boolean } = {}) {
  const headings = ['METHODS', 'URI', 'TYPE'];
  if (options.sizes) headings.push('FIRST LOAD');
  return new Table({
    head: headings.map((title) => kleur.bold(title)),
    wordWrap: true,
    colAligns: ['center', 'left', 'center', 'center'],
    style: { compact: true },
  });
}

function addRoutesToTable(
  table: ReturnType<typeof createRoutesTable>,
  links: string[],
  routes: RoutesMap,
  { build, bundles }: RoutesLoggerInput,
  options: { sizes?: boolean } = {},
) {
  for (const link of links) {
    const { pathname, type, redirect, ...info } = routes.get(link)!;

    let uri = pathname
      ? noslash(pathname).replace('{/}?{index}?{.html}?', '')
      : noslash(link);

    if (uri === '') uri = '/';

    const methods = info.methods ?? ['GET'];
    const typeColor = TYPE_COLOR[type.toUpperCase()];
    const typeTitle = redirect ? `${redirect.status}` : type.toLowerCase();

    const row = [
      kleur.bold(
        methods.map((method) => METHOD_COLOR[method](method)).join('|'),
      ),
      uri.replace(/(\[.*?\])/g, (g) => kleur.bold(kleur.yellow(g))),
      typeColor(typeTitle),
    ];

    if (pathname && options.sizes) {
      const size = computeRouteSize(pathname, build, bundles);
      row.push(prettySize(size));
    }

    table.push(row);
  }
}

export function computeRouteSize(
  routeId: string,
  build: BuildData,
  bundles: BuildBundles,
) {
  const chunks: OutputChunk[] = [];

  const entries = [
    ...build.resources.entry,
    ...build.resources.app,
    ...(build.resources.routes[routeId] ?? []),
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
