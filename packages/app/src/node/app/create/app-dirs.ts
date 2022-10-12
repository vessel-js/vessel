import { globbySync } from 'globby';
import fs from 'node:fs';
import * as path from 'pathe';
import { searchForWorkspaceRoot } from 'vite';

import type { AppDirectories, Directory } from '../App';
import type { ResolvedAppConfig } from '../config';

export function createAppDirectories(
  root: string,
  config: ResolvedAppConfig,
): AppDirectories {
  const cwdDir = createDirectory(process.cwd());
  const rootDir = createDirectory(root);
  const workspaceDir = createDirectory(
    searchForWorkspaceRoot(cwdDir.path, rootDir.path),
  );
  const appDir = createDirectory(config.dirs.app);
  const buildDir = createDirectory(config.dirs.build);
  const publicDir = createDirectory(config.dirs.public);
  const vesselDir = createDirectory(rootDir.resolve('.vessel'));
  return {
    cwd: cwdDir,
    workspace: workspaceDir,
    root: rootDir,
    app: appDir,
    build: buildDir,
    public: publicDir,
    vessel: {
      root: vesselDir,
      client: createDirectory(vesselDir.resolve('client')),
      server: createDirectory(vesselDir.resolve('server')),
    },
  };
}

export function createDirectory(dirname: string): Directory {
  const cwd = path.normalize(dirname);

  const resolve = (...args: string[]) => path.resolve(cwd, ...args);

  const relative = (...args: string[]) =>
    path.relative(cwd, path.join(...args));

  const read = (filePath: string) =>
    fs.readFileSync(resolve(filePath), 'utf-8');

  const write = (filePath: string, data: string) =>
    fs.writeFileSync(resolve(filePath), data);

  const glob = (patterns: string | string[]) => globbySync(patterns, { cwd });

  return {
    path: cwd,
    resolve,
    relative,
    read,
    write,
    glob,
  };
}
