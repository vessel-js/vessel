import { createFilter } from '@rollup/pluginutils';
import { comparePathDepth, sortedInsert } from 'node/utils';
import path from 'node:path';
import {
  getRouteTypes,
  isErrorRoute,
  isPageRoute,
  type Route,
} from 'shared/routing';

import type { App } from '../App';
import {
  type SystemDirMeta,
  type SystemFileMeta,
  SystemFiles,
} from './SystemFiles';

export type RouteFile = SystemFileMeta & {
  type: Route['type'];
  readonly moduleId: string;
};

export type RouteFileGroup = SystemDirMeta & {
  [P in Route['type']]?: RouteFile;
};

export class RouteFiles extends SystemFiles<RouteFile> {
  protected _groups: RouteFileGroup[] = [];

  protected _pageFilter!: (id: string) => boolean;
  protected _layoutFilter!: (id: string) => boolean;
  protected _errorFilter!: (id: string) => boolean;
  protected _httpFilter!: (id: string) => boolean;

  get groups() {
    return [...this._groups];
  }

  init(app: App) {
    const config = app.config.routes;
    this._pageFilter = createFilter(config.pages.include, config.pages.exclude);
    this._layoutFilter = createFilter(
      config.layouts.include,
      config.layouts.exclude,
    );
    this._errorFilter = createFilter(
      config.errors.include,
      config.errors.exclude,
    );
    this._httpFilter = createFilter(config.http.include, config.http.exclude);
    return super.init(app, {
      include: [
        ...config.layouts.include,
        ...config.errors.include,
        ...config.pages.include,
        ...config.http.include,
      ],
      exclude: [
        ...config.layouts.exclude,
        ...config.errors.exclude,
        ...config.pages.exclude,
        ...config.http.exclude,
      ],
    });
  }

  add(filePath: string) {
    const file = this._createFile(filePath);
    const type = this.resolveFileRouteType(file.rootPath);
    if (!type) return;
    const routeFile = { ...file, type, moduleId: `/${file.rootPath}` };
    this._addFile(routeFile);
    this._addToGroup(routeFile);
  }

  remove(filePath: string) {
    const type = this.resolveFileRouteType(filePath);
    const group = this.findGroup(filePath);
    if (group && type) {
      delete group[type];
      if (!getRouteTypes().some((type) => group[type])) {
        this._groups = this._groups.filter((g) => group !== g);
      }
    }
    return super.remove(filePath);
  }

  isPageFile(filePath: string) {
    return this._pageFilter(filePath);
  }

  isLayoutFile(filePath: string) {
    return this._layoutFilter(filePath);
  }

  isErrorFile(filePath: string) {
    return this._errorFilter(filePath);
  }

  isHttpFile(filePath: string) {
    return this._httpFilter(filePath);
  }

  isLeafFile(filePath: string) {
    return this.isPageFile(filePath) || this.isErrorFile(filePath);
  }

  findWithType(filePath: string, type: Route['type']) {
    return this.toArray().find(
      (file) => file.type === type && file.path === filePath,
    );
  }

  findLeafFile(filePath: string) {
    return this._files.find(
      (file) =>
        file.path === filePath && (isPageRoute(file) || isErrorRoute(file)),
    );
  }

  resolveFileRouteType(filePath: string): Route['type'] | null {
    if (this.isPageFile(filePath)) {
      return 'page';
    } else if (this.isLayoutFile(filePath)) {
      return 'layout';
    } else if (this.isErrorFile(filePath)) {
      return 'error';
    } else if (this.isHttpFile(filePath)) {
      return 'http';
    } else {
      return null;
    }
  }

  findGroup(filePath: string): RouteFileGroup | undefined {
    const routeDir = path.posix.dirname(this._getRoutePath(filePath));
    return this._groups.find((group) => group.routeDir === routeDir);
  }

  getGroupBranch(filePath: string) {
    const routeDir = path.posix.dirname(this._getRoutePath(filePath));
    return this._groups.filter((group) => routeDir.startsWith(group.routeDir));
  }

  toArray(type?: Route['type']): RouteFile[] {
    const array = super.toArray();
    return type ? array.filter((file) => file.type === type) : array;
  }

  protected _addToGroup(file: RouteFile) {
    const group = this.findGroup(file.path);
    if (group) {
      group[file.type] = file;
    } else {
      const group = {
        rootDir: file.rootDir,
        routeDir: file.routeDir,
        [file.type]: file,
      };
      sortedInsert(this._groups, group, (a, b) =>
        comparePathDepth(a.routeDir, b.routeDir),
      );
    }
  }
}
