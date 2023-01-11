import kleur from 'kleur';

import { sortedInsert, trimExt } from 'node/utils';
import type { ServerApiModule, ServerLoadablePageRoute, ServerPageModule } from 'server';
import { getRouteComponentTypes, type Route } from 'shared/routing';
import type { Mutable } from 'shared/types';

import type { App } from '../App';
import type { RouteMatcherConfig } from '../config';
import {
  getRouteFileTypes,
  resolveRouteFromFilePath,
  type RouteFile,
  type RouteFileType,
  type SystemDirPath,
} from '../files';

export type AppRoute = Route & {
  dir: SystemDirPath;
  client: boolean;
  /** Route id without any file ext. */
  cleanId: string;
} & {
  [P in RouteFileType]?: RouteFile & {
    viteLoader: () => Promise<P extends 'api' ? ServerApiModule : ServerPageModule>;
  };
};

const routeGroupRE = /\(.*?\)/;

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
    const existingRoute = this._routes.find((route) => route.id === file.routeId);

    if (existingRoute && (file.type === 'page' || file.type === 'api')) {
      const matchingRoute = this._routes.find(
        (route) => route.pathname === existingRoute.pathname && route !== existingRoute,
      );
      if (matchingRoute && matchingRoute[file.type]) {
        this._onDuplicateRoute(file.path.root, matchingRoute[file.type]!.path.root);
      }
    }

    const routeInfo = resolveRouteFromFilePath(
      this._app.dirs.app.path,
      file.path.absolute,
      this._matchers,
    );

    const route: AppRoute = existingRoute ?? {
      ...routeInfo,
      cleanId: trimExt(routeInfo.id),
      dir: file.dir,
      client: file.type !== 'api',
    };

    route[file.type] = {
      ...file,
      viteLoader: () => this._app.vite.server!.ssrLoadModule(file.path.absolute),
    };

    if (existingRoute && file.type !== 'api') {
      existingRoute.client = true;
    }

    if (!existingRoute) {
      sortedInsert(this._routes, route, (a, b) => {
        const diff = b.score - a.score;

        // Ensure route groups are put infront of their parent directories.
        if (Math.abs(diff) <= 1) {
          const segment = Math.min(a.dir.length, b.dir.length),
            isARouteGroup = routeGroupRE.test(a.dir.root.split('/')[segment]),
            isBRouteGroup = routeGroupRE.test(b.dir.root.split('/')[segment]);
          if (isARouteGroup && !isBRouteGroup) return -1;
          else if (isBRouteGroup && !isARouteGroup) return 1;
          else if (isARouteGroup && isBRouteGroup) return b.dir.length - a.dir.length;
        }

        return diff;
      });
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
        route.client = false;
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
    return this._routes.find((route) => route.id === file.routeId && route[file.type]);
  }

  getBranch(route: RouteFile | AppRoute) {
    const id = 'routeId' in route ? route.routeId : route.id;
    return this._routes.filter((route) => id.startsWith(route.id));
  }

  getLayoutBranch(route: RouteFile | AppRoute) {
    return this.getBranch(route)
      .filter((route) => route.layout)
      .map((route) => route.layout!);
  }

  filterClientRoutes() {
    return this._routes.filter((route) => route.client);
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

  protected _onDuplicateRoute(fileA: string, fileB: string) {
    const title = 'Duplicate Route';
    const message = [
      '\nMultiple files are resolving to the same route, please remove one of them:',
      `\nFile A: ${kleur.bold(fileA)}`,
      `File B: ${kleur.bold(fileB)}\n`,
    ].join('\n');
    if (this._app.config.isBuild) {
      this._app.logger.error(kleur.bold(title), message);
      throw new Error('duplicate routes');
    } else {
      this._app.logger.warn(kleur.bold(title), message);
    }
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

const validRouteKeys: (keyof Route)[] = ['id', 'score', 'pathname', 'pattern', 'dynamic'];

export function toRoute(appRoute: AppRoute): Route {
  const route: any = {};
  for (const key of validRouteKeys) route[key] = appRoute[key];
  return route;
}

export function toServerLoadable(route: AppRoute): ServerLoadablePageRoute {
  const loadable: Mutable<ServerLoadablePageRoute> = toRoute(route);

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
