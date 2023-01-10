import fs from 'node:fs';

import * as path from 'pathe';

export function trimExt(filePath: string) {
  return filePath.substring(0, filePath.lastIndexOf('.')) || filePath;
}

export const resolveRelativePath = (base: string, filePath: string): string => {
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(fs.lstatSync(base).isDirectory() ? base : path.dirname(base), filePath);
};

export const isSubpath = (parent: string, filePath: string): boolean => {
  const relative = path.relative(parent, filePath);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};
