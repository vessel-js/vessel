import kleur from 'kleur';
import {
  createStaticDataScriptTag,
  formatCommittedFilesTitle,
  formatWritingFilesTitle,
  pluralize,
  writeFiles,
} from 'node/build/build-utils';
import { buildAllSitemaps } from 'node/build/sitemap';
import { copyDir, logger, LoggerIcon } from 'node/utils';
import ora from 'ora';
import { createDocumentResourceLinkTags } from 'server';

import { type BuildAdapterFactory } from '../build-adapter';

export type StaticBuildAdapterConfig = {
  /** Whether to write the output to the `<build>` directory. */
  output?: boolean;
};

export function createStaticBuildAdapter({
  output = true,
}: StaticBuildAdapterConfig = {}): BuildAdapterFactory {
  return (app, bundles, build) => {
    logger.info(kleur.bold(`vessel@${app.version}`));

    const trailingSlashes = app.config.routes.trailingSlash;
    const trailingSlashTag = !trailingSlashes
      ? `<script>__VSL_TRAILING_SLASH__ = false;</script>`
      : '';

    return {
      name: 'static',
      async write() {
        console.log(kleur.magenta('\n+ static\n'));

        // ---------------------------------------------------------------------------------------
        // REDIRECTS
        // ---------------------------------------------------------------------------------------

        const redirectFiles = new Map<string, string>();
        const redirectsTable: Record<string, string> = {};

        for (const redirect of build.static.redirects.values()) {
          redirectFiles.set(redirect.filename, redirect.html);
          redirectsTable[redirect.from] = redirect.to;
        }

        let redirectsScriptTag = '';
        if (Object.keys(redirectsTable).length > 0) {
          // Embedded as a string and `JSON.parsed` from the client because it's faster than
          // embedding as a JS object literal.
          const serializedRedirectsTable = JSON.stringify(
            JSON.stringify(redirectsTable),
          );

          redirectsScriptTag = `<script>__VSL_STATIC_REDIRECTS_MAP__ = JSON.parse(${serializedRedirectsTable});</script>`;
        }

        // ---------------------------------------------------------------------------------------
        // Data
        // ---------------------------------------------------------------------------------------

        const dataFiles = new Map<string, string>();

        for (const data of build.static.data.values()) {
          dataFiles.set(data.filename, data.serializedData);
        }

        let dataHashScriptTag = '';
        if (dataFiles.size > 0) {
          // Embedded as a string and `JSON.parsed` from the client because it's faster than
          // embedding as a JS object literal.
          const serializedRecord = JSON.stringify(
            JSON.stringify(build.static.clientHashRecord),
          );
          dataHashScriptTag = `<script>__VSL_STATIC_DATA_HASH_MAP__ = JSON.parse(${serializedRecord});</script>`;
        }

        // ---------------------------------------------------------------------------------------
        // HTML Pages
        // ---------------------------------------------------------------------------------------

        const htmlFiles = new Map<string, string>();

        const buildingSpinner = ora();
        const htmlCount = build.static.renders.size;

        buildingSpinner.start(
          kleur.bold(
            `Building ${kleur.underline(htmlCount)} HTML ${pluralize(
              'page',
              htmlCount,
            )}...`,
          ),
        );

        const entrySrc = bundles.client.entry.chunk.fileName;
        const entryScriptTag = `<script type="module" src="/${entrySrc}" defer></script>`;

        for (const render of build.static.renders.values()) {
          const linkTags = createDocumentResourceLinkTags(build.resources.all, [
            ...build.resources.entry,
            ...build.resources.app,
            ...build.resources.routes[render.route.id],
          ]);

          const headTags = [
            ...linkTags,
            render.ssr.css ?? '',
            render.ssr.head ?? '',
          ]
            .filter((t) => t.length > 0)
            .join('\n    ');

          const bodyTags = [
            render.ssr.body ?? '',
            redirectsScriptTag,
            dataHashScriptTag,
            createStaticDataScriptTag(render.data, build),
            trailingSlashTag,
            entryScriptTag,
          ]
            .filter((t) => t.length > 0)
            .join('\n    ');

          let pageHtml = build.template
            .replace(`<!--@vessel/head-->`, headTags)
            .replace('<!--@vessel/body-->', bodyTags)
            .replace(`<!--@vessel/app-->`, render.ssr.html);

          if (render.ssr.htmlAttrs) {
            pageHtml = pageHtml.replace(
              /<html(.*?)>/,
              `<html${render.ssr.htmlAttrs}>`,
            );
          }

          if (render.ssr.bodyAttrs) {
            pageHtml = pageHtml.replace(
              /<body(.*?)>/,
              `<body${render.ssr.bodyAttrs}>`,
            );
          }

          htmlFiles.set(render.filename, pageHtml);
        }

        buildingSpinner.stopAndPersist({
          text: kleur.bold(
            `Built ${kleur.underline(htmlCount)} HTML ${pluralize(
              'page',
              htmlCount,
            )}`,
          ),
          symbol: LoggerIcon.Success,
        });

        // ---------------------------------------------------------------------------------------
        // SITEMAPS
        // ---------------------------------------------------------------------------------------

        if (app.config.sitemap.length > 0) {
          const sitemapsSpinner = ora();
          const sitemapCount = kleur.underline(app.config.sitemap.length);

          sitemapsSpinner.start(
            kleur.bold(`Building ${sitemapCount} sitemaps...`),
          );

          const sitemaps = await buildAllSitemaps(app, build);
          for (const [filename, content] of sitemaps) {
            htmlFiles.set(filename, content);
          }

          sitemapsSpinner.stopAndPersist({
            text: kleur.bold(`Built ${sitemapCount} sitemaps`),
            symbol: LoggerIcon.Success,
          });
        }

        // ---------------------------------------------------------------------------------------
        // WRITE
        // ---------------------------------------------------------------------------------------

        await writeFiles(
          htmlFiles,
          (filename) => app.dirs.client.resolve(filename),
          (count) => formatWritingFilesTitle('HTML', 'file', count),
          (count) => formatCommittedFilesTitle('HTML', 'file', count),
        );

        await writeFiles(
          redirectFiles,
          (filename) => app.dirs.client.resolve(filename),
          (count) => formatWritingFilesTitle('HTML redirect', 'file', count),
          (count) => formatCommittedFilesTitle('HTML redirect', 'file', count),
        );

        await writeFiles(
          dataFiles,
          (filename) => app.dirs.client.resolve(filename),
          (count) => formatWritingFilesTitle('static data', 'file', count),
          (count) => formatCommittedFilesTitle('static data', 'file', count),
        );

        if (output) {
          copyDir(app.dirs.client.path, app.dirs.build.path);
        }
      },
    };
  };
}

export { createStaticBuildAdapter as default };
