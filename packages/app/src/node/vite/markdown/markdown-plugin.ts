import { createFilter } from '@rollup/pluginutils';
import { readFile } from 'fs/promises';
import { toHtml } from 'hast-util-to-html';
import kleur from 'kleur';
import * as path from 'pathe';
import type { ViteDevServer } from 'vite';

import type { App } from 'node/app/App';
import { resolveRouteIdFromFilePath, RouteDir, RouteFile, RouteFileType } from 'node/app/files';
import {
  clearMarkdownCache,
  parseMarkdown,
  type HighlightCodeBlock,
  type ParseMarkdownResult,
} from 'node/markdoc';
import type { MarkdownMeta } from 'shared/markdown';

import { invalidateRouteModule } from '../files/files-hmr';
import type { VesselPlugin } from '../Plugin';
import { handleMarkdownHMR } from './hmr';

export function markdownPlugin(): VesselPlugin {
  let app: App;
  let filter: (id: string) => boolean;
  let currentFile: RouteFile | undefined = undefined;
  let currentBranch: RouteDir[] = [];
  let parse: (filePath: string, content: string) => ParseMarkdownResult;
  let highlight: HighlightCodeBlock | null = null;

  return {
    name: '@vessel/markdown',
    enforce: 'pre',
    vessel: {
      async configureApp(_app) {
        app = _app;

        const config = app.config.markdown;

        const { include, exclude, hastToHtml, highlighter, ...parseOptions } = config;

        highlight = typeof highlighter === 'function' ? highlighter : null;

        parse = (filePath: string, content: string) =>
          parseMarkdown(app, filePath, content, {
            ignoreCache: false,
            filter,
            highlight: (code, lang) => highlight?.(code, lang),
            ...parseOptions,
          });

        filter = createFilter(include, exclude);

        if (highlighter === 'starry-night') {
          try {
            const mod = await import('@wooorm/starry-night');
            const starryNight = await mod.createStarryNight(mod.all);

            highlight = (code, lang) => {
              const scope = starryNight.flagToScope(lang);
              if (!scope) return '';
              const tree = starryNight.highlight(code, scope);
              return toHtml(tree, hastToHtml);
            };
          } catch (error) {
            app.logger.error(
              `Failed to import \`@wooorm/starry-night\`, is it installed?`,
              `\n\n${kleur.bold('npm install @wooorm/starry-night')}`,
              `\n\n${error}`,
            );
          }
        }

        if (highlighter === 'shiki') {
          try {
            const mod = await import('shiki');
            const shiki = await mod.getHighlighter(config.shiki);
            const theme =
              (typeof config.shiki.theme === 'string'
                ? config.shiki.theme
                : config.shiki.theme?.name) ?? 'material-palenight';
            highlight = (code, lang) => {
              const tokens = shiki.codeToThemedTokens(code, lang);
              return mod.renderToHtml(tokens, {
                fg: shiki.getForegroundColor(theme),
                bg: shiki.getBackgroundColor(theme),
              });
            };
          } catch (error) {
            app.logger.error(
              `Failed to import \`shiki\`, is it installed?`,
              `\n\n${kleur.bold('npm install shiki')}`,
              `\n\n${error}`,
            );
          }
        }

        await app.markdoc.init(app);
      },
    },
    async configureServer(server) {
      handleMarkdownHMR(app);
      server.ws.on('vessel::route_change', ({ id }) => {
        const filePath = app.dirs.app.resolve(id);
        currentFile = app.files.routes.findLeafFile(filePath);
        currentBranch = app.files.routes.getDirBranch(filePath);
      });
    },
    transform(content, id) {
      if (filter(path.normalize(id))) {
        const { output } = parse(path.normalize(id), content);
        return output;
      }

      return null;
    },
    async handleHotUpdate(ctx) {
      const { file, server, read } = ctx;

      if (filter(file)) {
        const content = await read();

        const layout = app.files.routes.findWithType(file, 'layout');

        if (currentFile) {
          if (
            layout &&
            currentBranch.find((group) => group.layout?.path.root === layout.path.root)
          ) {
            clearMarkdownCache(currentFile.path.absolute);
            invalidateRouteModule(server, currentFile);

            const { meta } = parse(
              currentFile.path.absolute,
              await readFile(currentFile.path.absolute, { encoding: 'utf-8' }),
            );

            handleMarkdownMetaHMR(
              server,
              app.dirs.app.path,
              currentFile.path.absolute,
              currentFile.type,
              meta,
            );
          }
        }

        const { output, meta } = parse(file, content);
        ctx.read = () => output;

        if (!layout) {
          const type = app.files.routes.resolveFileRouteType(file);
          if (type) {
            handleMarkdownMetaHMR(server, app.dirs.app.path, file, type, meta);
          }
        }
      }
    },
  };
}

function handleMarkdownMetaHMR(
  server: ViteDevServer,
  appDir: string,
  filePath: string,
  type: RouteFileType,
  meta: MarkdownMeta,
) {
  server.ws.send({
    type: 'custom',
    event: 'vessel::md_meta',
    data: { id: resolveRouteIdFromFilePath(appDir, filePath), type, meta },
  });
}
