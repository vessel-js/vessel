import { createFilter } from '@rollup/pluginutils';
import { comparePathDepth, sortedInsert } from 'node/utils';
import path from 'node:path';
import {
  getRouteComponentTypes,
  type RouteComponentType,
} from 'shared/routing';

import type { App } from '../App';
import {
  type SystemDirPath,
  type SystemFileMeta,
  SystemFiles,
} from './SystemFiles';

export type RouteFileType = RouteComponentType | 'http';

export type RouteFile = SystemFileMeta & {
  readonly moduleId: string;
  readonly type: RouteFileType;
};

export type RouteDir = { path: SystemDirPath } & {
  [P in RouteFileType]?: RouteFile;
};

const routeFileTypes = [...getRouteComponentTypes(), 'http'] as const;
export function getRouteFileTypes(): readonly RouteFileType[] {
  return routeFileTypes;
}

export class RouteFiles extends SystemFiles<RouteFile> {
  protected _dirs: RouteDir[] = [];

  protected _pageFilter!: (id: string) => boolean;
  protected _layoutFilter!: (id: string) => boolean;
  protected _errorBoundaryFilter!: (id: string) => boolean;
  protected _httpFilter!: (id: string) => boolean;

  get dirs() {
    return [...this._dirs];
  }

  init(app: App) {
    const config = app.config.routes;
    this._pageFilter = createFilter(config.pages.include, config.pages.exclude);
    this._layoutFilter = createFilter(
      config.layouts.include,
      config.layouts.exclude,
    );
    this._errorBoundaryFilter = createFilter(
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
    const type = this.resolveFileRouteType(file.path.root);
    if (!type) return;
    const routeFile = { ...file, type, moduleId: `/${file.path.root}` };
    this._addFile(routeFile);
    this._addToDir(routeFile);
  }

  remove(filePath: string) {
    const type = this.resolveFileRouteType(filePath);
    const dir = this.findDir(filePath);
    if (dir && type) {
      delete dir[type];
      if (!getRouteFileTypes().some((type) => dir[type])) {
        this._dirs = this._dirs.filter((d) => dir !== d);
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

  isErrorBoundaryFile(filePath: string) {
    return this._errorBoundaryFilter(filePath);
  }

  isHttpFile(filePath: string) {
    return this._httpFilter(filePath);
  }

  isLeafFile(filePath: string) {
    return this.isPageFile(filePath) || this.isErrorBoundaryFile(filePath);
  }

  findWithType(filePath: string, type: RouteFileType) {
    return this.toArray().find(
      (file) => file.type === type && file.path.absolute === filePath,
    );
  }

  findLeafFile(filePath: string) {
    return this._files.find(
      (file) =>
        file.path.absolute === filePath &&
        (file.type === 'page' || file.type === 'errorBoundary'),
    );
  }

  resolveFileRouteType(filePath: string): RouteFileType | null {
    if (this.isPageFile(filePath)) {
      return 'page';
    } else if (this.isLayoutFile(filePath)) {
      return 'layout';
    } else if (this.isErrorBoundaryFile(filePath)) {
      return 'errorBoundary';
    } else if (this.isHttpFile(filePath)) {
      return 'http';
    } else {
      return null;
    }
  }

  findDir(filePath: string): RouteDir | undefined {
    const routeDir = path.posix.dirname(this._getRoutePath(filePath));
    return this._dirs.find((dir) => dir.path.route === routeDir);
  }

  getDirBranch(filePath: string) {
    const routeDir = path.posix.dirname(this._getRoutePath(filePath));
    return this._dirs.filter((dir) => routeDir.startsWith(dir.path.route));
  }

  toArray(type?: RouteFileType): RouteFile[] {
    const array = super.toArray();
    return type ? array.filter((file) => file.type === type) : array;
  }

  protected _addToDir(file: RouteFile) {
    const dir = this.findDir(file.path.absolute);
    if (dir) {
      dir[file.type] = file;
    } else {
      const dir = { path: file.dir, [file.type]: file };
      sortedInsert(this._dirs, dir, (a, b) =>
        comparePathDepth(a.path.route, b.path.route),
      );
    }
  }
}
