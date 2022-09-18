import { createFilter } from '@rollup/pluginutils';
import { globbySync } from 'globby';
import { comparePathDepth, normalizePath, sortedInsert } from 'node/utils';
import path from 'node:path';
import { isString } from 'shared/utils/unit';

import type { App } from '../App';

export type SystemFilePath = {
  /** Absolute system file path. */
  readonly absolute: string;
  /** System file path relative to `<root>`. */
  readonly root: string;
  /** System file path relative to `<app>`. */
  readonly route: string;
  /** System file route path as URL pathname `/blog/[product]/` */
  readonly pathname: string;
};

export type SystemDirPath = {
  /** Absolute system directory path. */
  readonly absolute: string;
  /** System directory path relative to `<root>`. */
  readonly root: string;
  /** System directory path relative to `<app>`. */
  readonly route: string;
};

export type SystemFileMeta = {
  /** File path meta. */
  readonly path: SystemFilePath;
  /** File dir meta. */
  readonly dir: SystemDirPath;
  /** Branch reset. */
  readonly reset?: boolean;
  /** System file extension name (e.g., `.tsx`). */
  readonly ext: string;
};

export type SystemFilesOptions = {
  include: string[];
  exclude?: (string | RegExp)[];
};

export abstract class SystemFiles<T extends SystemFileMeta>
  implements Iterable<T>
{
  protected _app!: App;
  protected _files: T[] = [];
  protected _options!: SystemFilesOptions;
  protected _filter!: (id: string) => boolean;
  protected _onAdd = new Set<(file: T) => void>();
  protected _onRemove = new Set<(file: T, index: number) => void>();

  get size() {
    return this._files.length;
  }

  async init(app: App, options: SystemFilesOptions) {
    this._app = app;
    this._options = options;
    this._filter = createFilter(options.include, options.exclude);
    await this._discover();
  }

  protected async _discover() {
    const filePaths = this._getFilePaths();
    await Promise.all(filePaths.map(this.add.bind(this)));
  }

  protected _getRootPath(filePath: string) {
    return this._app.dirs.root.relative(filePath);
  }

  protected _getRoutePath(filePath: string) {
    return this._app.dirs.app.relative(filePath);
  }

  protected _getFilePaths() {
    return globbySync(this._options.include, {
      absolute: true,
      cwd: this._app.dirs.app.path,
    })
      .map(normalizePath)
      .filter(this._filter);
  }

  abstract add(filePath: string): void;

  remove(filePath: string) {
    if (!this.has(filePath)) return -1;
    const index = this.findIndex(filePath);
    const file = this._files[index];
    this._files.splice(index, 1);
    for (const callback of this._onRemove) callback(file, index);
    return index;
  }

  getByIndex(index: number) {
    return this._files[index];
  }

  find(filePath: string) {
    return this._files.find((file) => file.path.absolute === filePath);
  }

  findIndex(filePath: string) {
    const file = this.find(filePath);
    return this._files.findIndex((n) => n === file);
  }

  has(filePath: string) {
    return !!this.find(filePath);
  }

  clear() {
    this._files = [];
  }

  is(filePath: string) {
    return (
      this.has(filePath) ||
      (filePath.startsWith(this._app.dirs.app.path) && this._filter(filePath))
    );
  }

  onAdd(callback: (file: T) => void) {
    this._onAdd.add(callback);
  }

  onRemove(callback: (file: T, index: number) => void) {
    this._onRemove.add(callback);
  }

  isSameBranch(file: string | T, childFilePath: string) {
    const ownerRootPath = this._getRootPath(childFilePath);
    const _file = isString(file) ? this.find(file) : file;
    return _file && ownerRootPath.startsWith(_file.dir.root);
  }

  getBranchFiles(childFilePath: string) {
    let files: T[] = [];

    for (let i = 0; i < this._files.length; i++) {
      const file = this._files[i];
      if (this.isSameBranch(file.path.absolute, childFilePath)) {
        if (file.reset) files = [];
        files.push(file);
      }
    }

    return files;
  }

  toArray() {
    return [...this._files];
  }

  protected _createFile(filePath: string): SystemFileMeta {
    const rootPath = this._getRootPath(filePath);
    const rootDir = path.posix.dirname(rootPath);
    const routePath = this._getRoutePath(filePath);
    const routeDir = path.posix.dirname(routePath);
    const pathname = routeDir === '.' ? '/' : `/${routeDir}/`;
    const ext = this._ext(rootPath);
    const reset = path.posix.basename(rootPath).includes('.reset.');
    return {
      path: {
        absolute: filePath,
        root: rootPath,
        route: routePath,
        pathname,
      },
      dir: {
        absolute: path.posix.dirname(filePath),
        root: rootDir,
        route: routeDir,
      },
      ext,
      reset,
    };
  }

  protected _ext(filePath: string) {
    return path.posix.extname(filePath);
  }

  protected _normalizePath(filePath: string) {
    return normalizePath(filePath);
  }

  protected _addFile(file: T) {
    sortedInsert(this._files, file, (a, b) =>
      comparePathDepth(a.path.root, b.path.root),
    );
    for (const callback of this._onAdd) callback(file);
  }

  [Symbol.iterator]() {
    let index = 0;
    return {
      next: () => {
        if (index < this._files.length) {
          return { value: this._files[index++], done: false };
        } else {
          return { done: true };
        }
      },
    } as IterableIterator<T>;
  }
}
