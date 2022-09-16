import { compareRoutes, type Route } from 'shared/routing';

import type { App } from '../App';
import type { RouteMatcherConfig } from '../config';
import type { SystemFileMeta, SystemFiles } from '../files';
import { resolveRouteFromFilePath } from './resolve-file-route';

export type SystemFileRoute<T extends SystemFileMeta = SystemFileMeta> =
  Route & { file: T };

export class SystemFileRoutes<T extends SystemFileMeta>
  implements Iterable<SystemFileRoute<T>>
{
  protected _routesDir!: string;
  protected _matchers!: RouteMatcherConfig;
  protected _type: Route['type'] = 'page';
  protected _routes = new Map<string, SystemFileRoute<T>>();
  protected _sortedRoutes: SystemFileRoute<T>[] = [];

  protected _onAdd = new Set<(route: SystemFileRoute<T>) => void>();
  protected _onRemove = new Set<
    (route: SystemFileRoute<T>, index: number) => void
  >();

  get size() {
    return this._routes.size;
  }

  init(app: App) {
    this._routesDir = app.dirs.app.path;
    this._matchers = app.config.routes.matchers;
  }

  add(file: T) {
    const route: SystemFileRoute<T> = {
      file,
      ...resolveRouteFromFilePath(
        this._type,
        this._routesDir,
        file.rootPath,
        this._matchers,
      ),
    };

    this._routes.set(file.routePath, route);

    this._sortedRoutes.push(route);
    this._sortedRoutes = this._sortedRoutes.sort(compareRoutes);

    for (const callback of this._onAdd) callback(route);
  }

  remove(file: T) {
    this._routes.delete(file.routePath);

    const index = this._sortedRoutes.findIndex((route) => route.file === file);
    if (index > -1) {
      const route = this._sortedRoutes[index];
      this._sortedRoutes.splice(index, 1);
      for (const callback of this._onRemove) callback(route, index);
    }
  }

  test(
    pathname: string,
    filter: (route: SystemFileRoute<T>) => boolean = () => true,
  ) {
    for (let i = 0; i < this._sortedRoutes.length; i++) {
      const route = this._sortedRoutes[i];
      if (filter(route) && route.pattern.test({ pathname })) return true;
    }

    return false;
  }

  getByFile(file: T) {
    return this._routes.get(file.routePath)!;
  }

  getByIndex(index: number) {
    return this._sortedRoutes[index];
  }

  onAdd(callback: (route: SystemFileRoute<T>) => void) {
    this._onAdd.add(callback);
  }

  onRemove(callback: (route: SystemFileRoute<T>, index: number) => void) {
    this._onRemove.add(callback);
  }

  toArray() {
    return this._sortedRoutes;
  }

  protected _watch(files: SystemFiles<T>) {
    for (const file of files) this.add(file);
    files.onAdd((file) => this.add(file));
    files.onRemove((file) => this.remove(file));
  }

  [Symbol.iterator]() {
    let index = 0;
    return {
      next: () => {
        if (index < this._sortedRoutes.length) {
          return { value: this._sortedRoutes[index++], done: false };
        } else {
          return { done: true };
        }
      },
    } as IterableIterator<SystemFileRoute<T>>;
  }
}
