import { sortedInsert } from 'node/utils';
import type {
  HttpRequestModule,
  ServerLoadableRoute,
  ServerModule,
} from 'server';
import {
  getRouteComponentTypes,
  type Route,
  stripRouteComponentTypes,
} from 'shared/routing';
import type { Mutable } from 'shared/types';

import type { App } from '../App';
import type { RouteMatcherConfig } from '../config';
import {
  getRouteFileTypes,
  type RouteFile,
  type RouteFileType,
  type SystemDirPath,
} from '../files';
import { resolveRouteFromFilePath } from './resolve-file-route';

export type AppRoute = Route & { dir: SystemDirPath } & {
  [P in RouteFileType]?: RouteFile & {
    viteLoader: () => Promise<
      P extends 'http' ? HttpRequestModule : ServerModule
    >;
  };
};

export class AppRoutes implements Iterable<AppRoute> {
  protected _app!: App;
  protected _routesDir!: string;
  protected _matchers!: RouteMatcherConfig;
  protected _routes: AppRoute[] = [];

  get size() {
    return this._routes.length;
  }

  get all() {
    return [...this._routes];
  }

  init(app: App) {
    this._app = app;
    this._routesDir = app.dirs.app.path;
    this._matchers = app.config.routes.matchers;

    for (const file of app.files.routes) this.add(file);
    app.files.routes.onAdd((file) => this.add(file));
    app.files.routes.onRemove((file) => this.remove(file));
  }

  add(file: RouteFile) {
    const existingRoute = this._routes.find(
      (route) => route.dir.route === file.dir.route,
    );

    const route: AppRoute = existingRoute ?? {
      ...resolveRouteFromFilePath(
        file.dir.route,
        this._matchers,
        file.type !== 'http',
      ),
      dir: file.dir,
    };

    route[file.type] = {
      ...file,
      viteLoader: () =>
        this._app.vite.server!.ssrLoadModule(file.path.absolute),
    };

    if (!existingRoute) {
      sortedInsert(this._routes, route, (a, b) => b.score - a.score);
    }
  }

  remove(file: RouteFile) {
    const route = this.find(file);
    if (route) {
      delete route[file.type];
      if (!getRouteFileTypes().some((type) => route[type])) {
        this._routes = this._routes.filter((g) => route !== g);
      }
    }
  }

  test(pathname: string, type?: RouteFileType) {
    for (let i = 0; i < this._routes.length; i++) {
      const route = this._routes[i];
      if ((!type || route[type]) && route.pattern.test({ pathname })) {
        return true;
      }
    }

    return false;
  }

  find(file: RouteFile) {
    return this._routes.find(
      (route) => route.dir.route === file.dir.route && route[file.type],
    );
  }

  getBranch(route: RouteFile | AppRoute) {
    const routeDir = route.dir.route;
    return this._routes.filter((group) => routeDir.startsWith(group.dir.route));
  }

  getLayoutBranch(route: RouteFile | AppRoute) {
    return this.getBranch(route)
      .filter((route) => route.layout)
      .map((route) => route.layout!);
  }

  filterByType(type: RouteFileType) {
    return this._routes.filter((route) => route[type]);
  }

  toArray() {
    return [...this._routes];
  }

  [Symbol.iterator]() {
    let index = 0;
    return {
      next: () => {
        if (index < this._routes.length) {
          return { value: this._routes[index++], done: false };
        } else {
          return { done: true };
        }
      },
    } as IterableIterator<AppRoute>;
  }
}

export function toServerLoadable(route: AppRoute): ServerLoadableRoute {
  const loadable: Mutable<ServerLoadableRoute> =
    stripRouteComponentTypes(route);

  for (const type of getRouteComponentTypes()) {
    if (route[type]) {
      loadable[type] = {
        loader: route[type]!.viteLoader,
      };
    }
  }

  return loadable;
}
