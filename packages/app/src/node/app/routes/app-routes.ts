import { sortedInsert } from 'node/utils';
import type {
  ServerDocumentModule,
  ServerHttpModule,
  ServerLoadableDocumentRoute,
} from 'server';
import { getRouteComponentTypes, type Route } from 'shared/routing';
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

export type AppRoute = Route & {
  dir: SystemDirPath;
  document: boolean;
} & {
  [P in RouteFileType]?: RouteFile & {
    viteLoader: () => Promise<
      P extends 'http' ? ServerHttpModule : ServerDocumentModule
    >;
  };
};

export class AppRoutes implements Iterable<AppRoute> {
  protected _app!: App;
  protected _routesDir!: string;
  protected _matchers!: RouteMatcherConfig;
  protected _routes: AppRoute[] = [];
  protected _onAdd = new Set<(route: AppRoute) => void>();
  protected _onRemove = new Set<(route: AppRoute) => void>();

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
      ...resolveRouteFromFilePath(file.dir.route, this._matchers),
      dir: file.dir,
      document: file.type !== 'http',
    };

    route[file.type] = {
      ...file,
      viteLoader: () =>
        this._app.vite.server!.ssrLoadModule(file.path.absolute),
    };

    if (existingRoute && file.type !== 'http') {
      existingRoute.document = true;
    }

    if (!existingRoute) {
      sortedInsert(this._routes, route, (a, b) => b.score - a.score);
    }

    for (const callback of this._onAdd) {
      callback(existingRoute ?? route);
    }
  }

  remove(file: RouteFile) {
    const route = this.find(file);
    if (route) {
      delete route[file.type];

      if (!getRouteFileTypes().some((type) => route[type])) {
        this._routes = this._routes.filter((g) => route !== g);
      } else if (!getRouteComponentTypes().some((type) => route[type])) {
        route.document = false;
      }

      for (const callback of this._onRemove) {
        callback(route);
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

  filterDocumentRoutes() {
    return this._routes.filter((route) => route.document);
  }

  filterHasType(type: RouteFileType) {
    return this._routes.filter((route) => route[type]);
  }

  toArray() {
    return [...this._routes];
  }

  onAdd(callback: (route: AppRoute) => void) {
    this._onAdd.add(callback);
    return () => {
      this._onAdd.delete(callback);
    };
  }

  onRemove(callback: (route: AppRoute) => void) {
    this._onRemove.add(callback);
    return () => {
      this._onRemove.delete(callback);
    };
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

const validRouteKeys: (keyof Route)[] = [
  'id',
  'order',
  'score',
  'pathname',
  'pattern',
  'dynamic',
];

export function toRoute(appRoute: AppRoute): Route {
  const route: any = {};
  for (const key of validRouteKeys) route[key] = appRoute[key];
  return route;
}

export function toServerLoadable(route: AppRoute): ServerLoadableDocumentRoute {
  const loadable: Mutable<ServerLoadableDocumentRoute> = toRoute(route);

  for (const type of getRouteFileTypes()) {
    if (route[type]) {
      loadable[type] = {
        loader: route[type]!.viteLoader,
        canFetch: true,
      };
    } else {
      delete loadable[type];
    }
  }

  return loadable;
}
