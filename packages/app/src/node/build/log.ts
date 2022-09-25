import kleur from 'kleur';
import type { App, AppRoute, RoutesLoggerInput } from 'node';
import { LoggerIcon } from 'node/utils';
import { noendslash, noslash } from 'shared/utils/url';

import type { BuildData } from './build-data';

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

export function logRoutesList({ level, ...build }: RoutesLoggerInput) {
  const logs: string[] = [];

  if (level === 'info') {
    logs.push('', `📄 ${kleur.bold(kleur.underline('STATIC PAGES'))}`, '');
    for (const link of build.links.keys()) {
      const page = build.links.get(link)!;
      const route = page.pattern.pathname
        .replace('{/}?{index}?{.html}?', '')
        .slice(1);
      const pathname = link.slice(1, -1);
      const pattern = pathname !== route ? kleur.dim(` (${route})`) : '';
      logs.push(
        `- ${kleur.cyan(
          link.length === 1 ? 'index.html' : `${pathname}/index${'.html'}`,
        )}${pattern}`,
      );
    }
  }

  if (level === 'info' && build.server.routes.size > 0) {
    const serverPages: string[] = [];
    const edgePages: string[] = [];

    for (const route of Array.from(build.server.routes).reverse()) {
      const logs = build.edge.routes.has(route.id) ? edgePages : serverPages;
      logs.push(`- ${kleur.cyan(route.dir.route)}`);
    }

    if (serverPages.length > 0) {
      logs.push(
        '',
        `⚙️  ${kleur.bold(kleur.underline('SERVER PAGES'))}`,
        '',
        ...serverPages,
      );
    }

    if (edgePages.length > 0) {
      logs.push(
        '',
        `⚡  ${kleur.bold(kleur.underline('EDGE PAGES'))}`,
        '',
        ...edgePages,
      );
    }
  }

  if (level === 'info' && build.server.endpoints.size > 0) {
    const serverEndpoints: string[] = [];
    const edgeEndpoints: string[] = [];

    for (const route of Array.from(build.server.endpoints).reverse()) {
      const logs = build.edge.routes.has(route.id)
        ? edgeEndpoints
        : serverEndpoints;

      logs.push(`- ${kleur.cyan(route.dir.route)}`);
    }

    if (serverEndpoints.length > 0) {
      logs.push(
        '',
        `⚙️  ${kleur.bold(kleur.underline('SERVER ENDPOINTS'))}`,
        '',
        ...serverEndpoints,
      );
    }

    if (edgeEndpoints.length > 0) {
      logs.push(
        '',
        `⚡  ${kleur.bold(kleur.underline('EDGE ENDPOINTS'))}`,
        '',
        ...edgeEndpoints,
      );
    }
  }

  if (/(info|warn)/.test(level) && build.static.redirects.size > 0) {
    logs.push('', `➡️  ${kleur.bold(kleur.underline('STATIC REDIRECTS'))}`, '');
    for (const link of build.static.redirects.keys()) {
      const redirect = build.static.redirects.get(link)!;
      logs.push(
        `- ${kleur.yellow(link)} -> ${kleur.yellow(redirect.to)} (${
          redirect.status
        })`,
      );
    }
  }

  if (/(info|warn|error)/.test(level) && build.badLinks.size > 0) {
    logs.push('', `🛑 ${kleur.bold(kleur.underline('NOT FOUND'))}`, '');
    for (const link of build.badLinks.keys()) {
      logs.push(`- ${kleur.red(link)} (404)`);
    }
  }

  if (logs.length > 0) {
    console.log(logs.join('\n'));
    console.log();
  }
}

export function logRoutesTree({ level, ...build }: RoutesLoggerInput) {
  type Tree = {
    name: string;
    path: Tree[];
    info?: string;
    route?: boolean;
    badLink?: boolean;
    icon?: string;
    static?: boolean;
    redirect?: {
      path: string;
      status: number;
    };
  };

  const node = (name: string): Tree => ({
    name,
    path: [],
  });

  const tree = node('/');

  const warnOnly = level === 'warn';
  const errorOnly = level === 'error';
  const redirectLinks = new Set(build.static.redirects.keys());

  const serverPages = new Map<string, AppRoute>();
  for (const route of build.server.routes) {
    serverPages.set(route.page!.path.pathname, route);
  }

  const httpEndpoints = new Map<string, AppRoute>();
  for (const route of build.server.endpoints) {
    httpEndpoints.set(route.http!.path.pathname, route);
  }

  const filteredLinks = errorOnly
    ? build.badLinks.keys()
    : warnOnly
    ? new Set([...build.badLinks.keys(), ...redirectLinks])
    : new Set([
        ...build.badLinks.keys(),
        ...redirectLinks,
        ...build.links.keys(),
        ...serverPages.keys(),
        ...httpEndpoints.keys(),
      ]);

  for (const link of filteredLinks) {
    if (link === '/') continue;

    const segments = noendslash(noslash(link)).split('/');

    let current = tree;
    for (const segment of segments) {
      let nextDir = current.path.find((dir) => dir.name === segment);

      if (!nextDir) {
        nextDir = node(segment);
        current.path.push(nextDir);
      }

      current = nextDir;
    }

    if (build.badLinks.has(link)) {
      current.badLink = true;
    } else if (build.static.redirects.has(link)) {
      const redirect = build.static.redirects.get(link)!;
      current.redirect = {
        path: redirect.to === '/' ? '/' : redirect.to.slice(1, -1),
        status: redirect.status,
      };
    } else {
      current.route = true;
      if (build.links.has(link)) {
        current.icon = '📄';
        current.static = true;
      } else if (httpEndpoints.has(link)) {
        current.info = kleur.magenta('+http');
        const routeId = httpEndpoints.get(link)!.id;
        if (build.edge.routes.has(routeId)) current.icon = '⚡';
      } else if (serverPages.has(link)) {
        const routeId = serverPages.get(link)!.id;
        if (build.edge.routes.has(routeId)) current.icon = '⚡';
      }
    }
  }

  const PRINT_SYMBOLS = {
    BRANCH: '├── ',
    EMPTY: '',
    INDENT: '    ',
    LAST_BRANCH: '└── ',
    VERTICAL: '│   ',
  };

  const print = (tree: Tree, depth: number, precedingSymbols: string) => {
    const lines: string[] = [];

    for (const [index, dir] of tree.path.entries()) {
      const line = [precedingSymbols];
      const isLast = index === tree.path.length - 1 && dir.path.length === 0;

      const name = dir.badLink
        ? `${kleur.red(dir.name)} ${kleur.red(kleur.bold('(404)'))}`
        : dir.redirect
        ? kleur.yellow(
            `${dir.name} -> ${dir.redirect.path} (${dir.redirect.status})`,
          )
        : `${kleur[dir.static ? 'cyan' : dir.route ? 'magenta' : 'white'](
            dir.name,
          )}${kleur.dim(dir.info ?? '')}`;

      line.push(isLast ? PRINT_SYMBOLS.LAST_BRANCH : PRINT_SYMBOLS.BRANCH);
      line.push(kleur.bold(`${dir.icon ? `${dir.icon}` : ''}${name}`));
      lines.push(line.join(''));

      const dirLines = print(
        dir,
        depth + 1,
        precedingSymbols +
          (depth >= 1
            ? isLast
              ? PRINT_SYMBOLS.INDENT
              : PRINT_SYMBOLS.VERTICAL
            : PRINT_SYMBOLS.EMPTY),
      );

      lines.push(...dirLines);
    }

    return lines;
  };

  if (tree.path.length > 0) {
    if (level === 'info') {
      console.log(`\n${kleur.bold(kleur.underline('ROUTES'))}`, '');
    }

    console.log(
      kleur.bold(
        build.links.has('/') ? kleur.cyan('\n📄/') : kleur.magenta('/'),
      ),
    );
    console.log(print(tree, 1, '').join('\n'));
  }
}

export function logRoutes(app: App, build: BuildData) {
  const style = app.config.routes.log;
  if (style !== 'none') {
    const logger =
      style === 'list'
        ? logRoutesList
        : style === 'tree'
        ? logRoutesTree
        : style;

    logger({
      level: app.config.routes.logLevel,
      ...build,
    });
  }
}
