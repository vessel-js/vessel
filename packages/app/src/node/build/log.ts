// eslint-disable-next-line import/no-named-as-default
import Table from 'cli-table3';
import { gzipSizeSync } from 'gzip-size';
import kleur from 'kleur';
import type { App } from 'node';
import { comparePathDepth, LoggerIcon } from 'node/utils';
import prettyBytes from 'pretty-bytes';
import type { OutputChunk } from 'rollup';
import { ALL_HTTP_METHODS } from 'shared/http';
import { noslash } from 'shared/utils/url';

import type { BuildData } from './build-data';

const METHOD_COLOR = {
  ANY: kleur.white,
  HEAD: kleur.dim,
  GET: kleur.green,
  POST: kleur.magenta,
  PUT: kleur.cyan,
  PATCH: kleur.yellow,
  DELETE: kleur.red,
};

const TYPE_COLOR = {
  STATIC: kleur.dim,
  SERVER: kleur.magenta,
  EDGE: kleur.green,
  NODE: kleur.white,
  REDIRECT: kleur.yellow,
  NOT_FOUND: kleur.red,
};

export async function logRoutesTable(app: App, build: BuildData) {
  console.log(kleur.magenta('\n+ routes\n'));
  logPagesTable(build);
  logApiTable(build);
}

function logPagesTable(build: BuildData) {
  const table = createRoutesTable({ sizes: true });
  const pages = build.routes.pages;

  const links = Array.from(pages.keys())
    .sort(naturalCompare)
    .sort(comparePathDepth);

  for (const link of links) {
    const route = pages.get(link)!;

    let uri = noslash(route.path).replace('{/}?{index}?{.html}?', '');
    if (uri === '') uri = '/';

    const typeColor = route.notFound
      ? TYPE_COLOR.NOT_FOUND
      : route.redirect
      ? TYPE_COLOR.REDIRECT
      : TYPE_COLOR[route.type.toUpperCase()];

    const typeTitle = route.notFound
      ? '404'
      : route.redirect
      ? route.redirect.status
      : route.type.toLowerCase();

    table.push([
      kleur.bold(
        route.methods.map((method) => METHOD_COLOR[method](method)).join('|'),
      ),
      uri.replace(/(\[.*?\])/g, (g) => kleur.bold(kleur.yellow(g))),
      typeColor(typeTitle),
      prettySize(computeRouteSize(route.path, build)),
    ]);
  }

  console.log(kleur.bold('PAGES'));
  console.log(table.toString());
}

function logApiTable(build: BuildData) {
  const table = createRoutesTable();
  const api = build.routes.api;

  const links = Array.from(api.keys())
    .sort(naturalCompare)
    .sort(comparePathDepth);

  for (const link of links) {
    const route = api.get(link)!;

    let uri = noslash(route.path).replace('{/}?{index}?{.html}?', '');
    if (uri === '') uri = '/';

    const typeColor = TYPE_COLOR[route.type.toUpperCase()];
    const typeTitle = route.type.toLowerCase();

    table.push([
      kleur.bold(
        // Sort
        ALL_HTTP_METHODS.filter((method) => route.methods.includes(method))
          .map((method) => METHOD_COLOR[method](method))
          .join('|'),
      ),
      uri.replace(/(\[.*?\])/g, (g) => kleur.bold(kleur.yellow(g))),
      typeColor(typeTitle),
    ]);
  }

  console.log(kleur.bold('API'));
  console.log(table.toString());
}

export async function logRoutes(app: App, build: BuildData) {
  const style = app.config.routes.log;
  if (style !== 'none') {
    const logger = style === 'table' ? logRoutesTable : style;
    await logger(app, build);
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

export function computeRouteSize(routeId: string, build: BuildData) {
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
      const chunk = build.bundles.client.chunks.find(
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
