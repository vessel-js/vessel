import { sortedInsert } from 'node/utils';
import { compareRoutes, getRouteTypes, type Route } from 'shared/routing';

import type { App } from '../App';
import type { RouteMatcherConfig } from '../config';
import type { RouteFile, SystemDirMeta } from '../files';
import {
  resolveRouteFromFilePath,
  resolveRouteInfoFromFilePath,
} from './resolve-file-route';

export type AppRoute = Route & { file: RouteFile };

export type AppRouteGroup = SystemDirMeta & {
  dynamic: boolean;
  score: number;
} & {
  [P in Route['type']]?: AppRoute;
};

export class AppRoutes implements Iterable<AppRoute> {
  protected _routesDir!: string;
  protected _matchers!: RouteMatcherConfig;

  protected _routes: AppRoute[] = [];
  protected _groups: AppRouteGroup[] = [];

  get size() {
    return this._routes.length;
  }

  get groups() {
    return [...this._groups];
  }

  init(app: App) {
    this._routesDir = app.dirs.app.path;
    this._matchers = app.config.routes.matchers;

    for (const file of app.files.routes) this.add(file);
    app.files.routes.onAdd((file) => this.add(file));
    app.files.routes.onRemove((file) => this.remove(file));
  }

  add(file: RouteFile) {
    const existingGroup = this._groups.find(
      (group) => group.routeDir === file.routeDir,
    );

    const group: AppRouteGroup = existingGroup ?? {
      ...resolveRouteInfoFromFilePath('page', file.routeDir),
      rootDir: file.rootDir,
      routeDir: file.routeDir,
    };

    const route: AppRoute = {
      file,
      ...resolveRouteFromFilePath(
        file.routePath,
        file.type,
        file.routeDir,
        this._matchers,
      ),
    };

    group[file.type] = route;

    sortedInsert(this._routes, route, compareRoutes);

    if (!existingGroup) {
      delete group['pathname'];
      sortedInsert(this._groups, group, (a, b) => b.score - a.score);
    }
  }

  remove(route: RouteFile | AppRoute) {
    const file = 'file' in route ? route.file : route;
    const group = this.findGroup(file);

    if (group) {
      delete group[file.type];
      if (!getRouteTypes().some((type) => group[type])) {
        this._groups = this._groups.filter((g) => group !== g);
      }
    }

    const index = this._routes.findIndex(
      (r) => r.file.moduleId === file.moduleId,
    );

    if (index > -1) this._routes.splice(index, 1);
    return index;
  }

  test(type: Route['type'], pathname: string) {
    for (let i = 0; i < this._routes.length; i++) {
      const route = this._routes[i];
      if (route.type === type && route.pattern.test({ pathname })) {
        return true;
      }
    }

    return false;
  }

  find(route: RouteFile | AppRoute) {
    const file = 'file' in route ? route.file : route;
    return this._groups.find(
      (group) => group.routeDir === file.routeDir && group[file.type],
    );
  }

  findGroup(route: RouteFile | AppRoute) {
    const file = 'file' in route ? route.file : route;
    return this._groups.find((group) => group.routeDir === file.routeDir);
  }

  getGroupBranch(route: RouteFile | AppRoute) {
    const file = 'file' in route ? route.file : route;
    return this._groups.filter((group) =>
      file.routeDir.startsWith(group.routeDir),
    );
  }

  filterByType(type: Route['type']) {
    return this._routes.filter((route) => route.type === type);
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
