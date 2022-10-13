import type { ClientManifest } from 'client/router/types';
import type { App } from 'node/app/App';
import { getRouteComponentTypes } from 'shared/routing';
import { prettyJsonStr, stripImportQuotesFromJson } from 'shared/utils/json';

import { virtualModuleRequestPath } from '../alias';
import type { VesselPlugin } from '../Plugin';
import { handleFilesHMR } from './files-hmr';
import { watchRoutesTypes } from './watch-routes-types';

export function filesPlugin(): VesselPlugin {
  let app: App;

  return {
    name: '@vessel/files',
    enforce: 'pre',
    vessel: {
      async configureApp(_app) {
        app = _app;
        await app.files.init(app);
        await app.routes.init(app);
        await watchRoutesTypes(app);
      },
    },
    async configureServer(server) {
      server.watcher.add(app.dirs.app.path);
      handleFilesHMR(app);
    },
    async load(id) {
      if (id === virtualModuleRequestPath.manifest) {
        return loadClientManifestModule(app);
      }

      return null;
    },
  };
}

export function loadClientManifestModule(app: App) {
  const clientRoutes = app.routes.filterClientRoutes();

  const loaders = clientRoutes.flatMap((route) =>
    getRouteComponentTypes()
      .map((type) =>
        route[type] ? `() => import('/${route[type]!.path.root}')` : '',
      )
      .filter((str) => str.length > 0),
  );

  // We'll replace production version after chunks are built so we can be sure `serverLoader` exists.
  const fetch = app.config.isBuild ? '__VSL_CAN_FETCH__' : [];

  const routes: ClientManifest['routes'] = [];

  for (let i = 0; i < clientRoutes.length; i++) {
    const route = clientRoutes[i];
    routes.push({
      u: [route.id, route.pathname, route.score],
      l: route.layout ? 1 : undefined,
      e: route.errorBoundary ? 1 : undefined,
      p: route.page ? 1 : undefined,
    });
  }

  return `export default ${stripImportQuotesFromJson(
    prettyJsonStr({ loaders, fetch, routes }),
  )};`;
}
