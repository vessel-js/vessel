import kleur from 'kleur';
import type { App } from 'node/app/App';
import { logger } from 'node/utils';
import { slash } from 'shared/utils/url';

import type { BuildData } from './build-data';
import { resolveApiChunkMethods } from './chunks';

export async function resolveAllRoutes(app: App, build: BuildData) {
  const pages: BuildData['routes']['pages'] = new Map();
  const api: BuildData['routes']['api'] = new Map();

  for (const [link, route] of build.links) {
    pages.set(slash(link), {
      type: 'static',
      path: route.id,
      methods: ['GET'],
      file: route.page!.path.route,
    });
  }

  for (const [link, info] of build.badLinks) {
    pages.set(slash(link), {
      type: 'static',
      notFound: true,
      path: link,
      methods: ['GET'],
      file: info.route?.page?.path.route,
    });
  }

  for (const [link, redirect] of build.static.redirects) {
    pages.set(slash(link), {
      type: 'static',
      path: redirect.to,
      methods: ['GET'],
      redirect: { status: redirect.status },
      file: redirect.filename,
    });
  }

  for (const route of build.server.pages) {
    pages.set(route.id, {
      type: build.edge.routes.has(route.id) ? 'edge' : 'node',
      path: route.pathname,
      methods: ['GET'],
      file: route.page?.path.route ?? route.id,
    });
  }

  for (const route of build.server.api) {
    api.set(route.id, {
      type: build.edge.routes.has(route.id) ? 'edge' : 'node',
      path: route.pathname,
      methods: resolveApiChunkMethods(route, build),
      file: route.api!.path.route,
    });
  }

  if (build.server.configs.edge) {
    const file = app.dirs.app.relative(
      build.bundles.server.configs.edge!.facadeModuleId!,
    );

    for (const route of build.server.configs.edge.apiRoutes) {
      if (api.has(route.id)) {
        const prev = api.get(route.id)!;
        throw logger.error(
          kleur.bold('Duplicate Route'),
          `\nServer configuration tried to overwrite existing path.`,
          `\n\nRoute: ${kleur.bold(route.pathname)}`,
          `\nConfig: ${kleur.bold(file)}`,
          `\nOriginal: ${kleur.bold(prev.file)}\n`,
        );
      }

      api.set(route.id, {
        path: route.pathname,
        type: 'edge',
        methods: route.methods!,
        file,
      });
    }
  }

  if (build.server.configs.node) {
    const file = app.dirs.app.relative(
      build.bundles.server.configs.node!.facadeModuleId!,
    );

    for (const route of build.server.configs.node.apiRoutes) {
      if (api.has(route.id)) {
        const prev = api.get(route.id)!;
        throw logger.error(
          kleur.bold('Duplicate Route'),
          `\nServer configuration tried to overwrite existing path.`,
          `\n\nRoute: ${kleur.bold(route.pathname)}`,
          `\nConfig: ${kleur.bold(file)}`,
          `\nOriginal: ${kleur.bold(prev.file)}\n`,
        );
      }

      api.set(route.id, {
        path: route.pathname,
        type: 'node',
        methods: route.methods!,
        file,
      });
    }
  }

  return { pages, api };
}
