import { createAutoBuildAdapter } from 'node/build/adapter';
import { resolveRelativePath } from 'node/utils';
import * as path from 'pathe';
import { isArray } from 'shared/utils/unit';

import type { AppConfig, ResolvedAppConfig } from './app-config';
import type { ResolvedBuildConfig } from './build-config';
import type { ResolvedClientConfig } from './client-config';
import type { ResolvedMarkdownConfig } from './markdown-config';
import type { ResolvedRoutesConfig } from './routes-config';
import type { ResolvedServerConfig } from './server-config';
import type { ResolvedSitemapConfig } from './sitemap-config';

export function resolveAppConfig(
  root: string,
  {
    build = {},
    dirs = {},
    debug: isDebug = !!process.env.DEBUG,
    entry = { client: '', server: '' },
    client = {},
    server = {},
    routes = {},
    markdown = {},
    sitemap,
  }: AppConfig,
): ResolvedAppConfig {
  const _cwd = path.normalize(process.cwd());
  const _root = resolveRelativePath(_cwd, root);
  const _app = resolveRelativePath(_root, dirs.app ?? 'app');
  const _public = resolveRelativePath(_app, dirs.public ?? 'public');
  const _output = resolveRelativePath(_root, dirs.build ?? 'build');

  const __build: ResolvedBuildConfig = {
    adapter: build.adapter ?? createAutoBuildAdapter(),
  };

  const __client: ResolvedClientConfig = {
    // Set later by a plugin.
    app: client.app ? path.relative(_root, client.app) : '',
  };

  const __server: ResolvedServerConfig = {
    config: {
      edge: ['**/+server.{js,ts}', '**/server.{js,ts}'],
      node: ['**/+server.node.{js,ts}', '**/server.node.{js,ts}'],
      ...server.config,
    },
  };

  const pageExts = `md,svelte,vue,jsx,tsx`;
  const apiExts = 'js,ts';

  const __routes: ResolvedRoutesConfig = {
    entries: routes.entries ?? [],
    trailingSlash: routes.trailingSlash ?? false,
    matchers: [
      ...(routes.matchers ?? []),
      { name: 'int', matcher: /\d+/ },
      { name: 'str', matcher: /\w+/ },
      { name: 'bool', matcher: /(true|false)/ },
      (route) => route.replace(/\[\[\.\.\.(.*?)\]\]/g, ':$1*'),
      (route) => route.replace(/\[\.\.\.(.*?)\]/g, ':$1+'),
      (route) => route.replace(/\[(.*?)\]/g, ':$1'),
    ],
    log: routes.log ?? 'table',
    edge: routes.edge ?? [],
    pages: {
      include: [`**/page.{${pageExts}}`, `**/*page.{${pageExts}}`],
      exclude: [],
      ...routes.pages,
    },
    layouts: {
      include: [`**/layout.{${pageExts}}`, `**/*layout.{${pageExts}}`],
      exclude: [],
      ...routes.pages,
    },
    errors: {
      include: [`**/error.{${pageExts}}`, `**/*error.{${pageExts}}`],
      exclude: [],
      ...routes.errors,
    },
    api: {
      include: [`**/api.{${apiExts}}`, `**/*api.{${apiExts}}`],
      exclude: [],
      ...routes.api,
    },
  };

  const __markdown: ResolvedMarkdownConfig = {
    include: markdown.include ?? /\.md$/,
    exclude: markdown.exclude ?? [],
    markdoc: markdown.markdoc ?? {},
    highlighter: false,
    shiki: { theme: 'material-palenight', langs: [] },
    hastToHtml: {},
    nodes: {
      include: [`**/.markdoc/**/*.{${pageExts}}`],
      exclude: [],
      ...markdown.nodes,
    },
    transformAst: [],
    transformContent: [],
    transformMeta: [],
    transformOutput: [],
    transformTreeNode: [],
    ...markdown,
  };

  const __sitemapConfig: ResolvedSitemapConfig = {
    origin: null,
    filename: 'sitemap.xml',
    changefreq: 'weekly',
    priority: 0.7,
    include: /.*/,
    exclude: null,
    entries: [],
  };

  const __sitemap: ResolvedSitemapConfig[] = (isArray(sitemap) ? sitemap : [sitemap])
    .filter(Boolean)
    .map((config) => ({ ...__sitemapConfig, ...config }));

  return {
    build: __build,
    dirs: {
      app: _app,
      build: _output,
      public: _public,
    },
    entry,
    client: __client,
    server: __server,
    routes: __routes,
    markdown: __markdown,
    sitemap: __sitemap,
    isBuild: false,
    isSSR: false,
    debug: isDebug,
  };
}
