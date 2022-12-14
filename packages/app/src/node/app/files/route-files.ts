import { createFilter } from '@rollup/pluginutils';
import * as path from 'pathe';

import { comparePathDepth, sortedInsert } from 'node/utils';
import { getRouteComponentTypes, type RouteComponentType } from 'shared/routing';

import type { App } from '../App';
import { resolveRouteIdFromFilePath } from './resolve-route';
import { SystemFiles, type SystemDirPath, type SystemFileMeta } from './system-files';

export type RouteFileType = RouteComponentType | 'api';

export interface RouteFile extends SystemFileMeta {
  readonly routeId: string;
  readonly moduleId: string;
  readonly type: RouteFileType;
}

export type RouteDir = { path: SystemDirPath } & {
  [P in RouteFileType]?: RouteFile;
};

const routeFileTypes = [...getRouteComponentTypes(), 'api'] as const;
export function getRouteFileTypes(): readonly RouteFileType[] {
  return routeFileTypes;
}

export class RouteFiles extends SystemFiles<RouteFile> {
  protected _dirs: RouteDir[] = [];

  protected _pageFilter!: (id: string) => boolean;
  protected _layoutFilter!: (id: string) => boolean;
  protected _errorBoundaryFilter!: (id: string) => boolean;
  protected _apiFilter!: (id: string) => boolean;

  get dirs() {
    return [...this._dirs];
  }

  init(app: App) {
    const config = app.config.routes;
    this._pageFilter = createFilter(config.pages.include, config.pages.exclude);
    this._layoutFilter = createFilter(config.layouts.include, config.layouts.exclude);
    this._errorBoundaryFilter = createFilter(config.errors.include, config.errors.exclude);
    this._apiFilter = createFilter(config.api.include, config.api.exclude);
    return super.init(app, {
      include: [
        ...config.layouts.include,
        ...config.errors.include,
        ...config.pages.include,
        ...config.api.include,
      ],
      exclude: [
        ...config.layouts.exclude,
        ...config.errors.exclude,
        ...config.pages.exclude,
        ...config.api.exclude,
      ],
    });
  }

  add(filePath: string) {
    const file = this._createFile(filePath);

    const type = this.resolveFileRouteType(file.path.root);
    if (!type) return;

    const routeFile = {
      ...file,
      type,
      routeId: resolveRouteIdFromFilePath(this._app.dirs.app.path, file.path.absolute),
      moduleId: `/${file.path.root}`,
    };

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

  isDocumentFile(filePath: string) {
    return (
      this.isPageFile(filePath) || this.isLayoutFile(filePath) || this.isErrorBoundaryFile(filePath)
    );
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

  isApiFile(filePath: string) {
    return this._apiFilter(filePath);
  }

  isLeafFile(filePath: string) {
    return this.isPageFile(filePath) || this.isErrorBoundaryFile(filePath);
  }

  findWithType(filePath: string, type: RouteFileType) {
    return this.toArray().find((file) => file.type === type && file.path.absolute === filePath);
  }

  findLeafFile(filePath: string) {
    return this._files.find(
      (file) =>
        file.path.absolute === filePath && (file.type === 'page' || file.type === 'errorBoundary'),
    );
  }

  resolveFileRouteType(filePath: string): RouteFileType | null {
    if (this.isPageFile(filePath)) {
      return 'page';
    } else if (this.isLayoutFile(filePath)) {
      return 'layout';
    } else if (this.isErrorBoundaryFile(filePath)) {
      return 'errorBoundary';
    } else if (this.isApiFile(filePath)) {
      return 'api';
    } else {
      return null;
    }
  }

  findDir(filePath: string): RouteDir | undefined {
    const routeDir = path.dirname(this._getRoutePath(filePath));
    return this._dirs.find((dir) => dir.path.route === routeDir);
  }

  getDirBranch(filePath: string) {
    const rootPath = this._getRootPath(filePath);
    return this._dirs.filter((dir) => rootPath.startsWith(dir.path.root));
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
      sortedInsert(this._dirs, dir, (a, b) => comparePathDepth(a.path.route, b.path.route));
    }
  }
}
