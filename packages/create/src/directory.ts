import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import * as path from 'pathe';

export type SystemDirectory = {
  path: string;
  read: (filePath: string) => Promise<string>;
  readSync: (filePath: string) => string;
  resolve: (...path: string[]) => string;
  relative: (...path: string[]) => string;
  exists: (filePath: string) => boolean;
  write: (filePath: string, content: string, overwrite?: boolean) => Promise<void>;
  append: (filePath: string, content: string) => Promise<void>;
  unlink: (filePath: string) => Promise<void>;
  copy: (src: string, dest: string) => Promise<void>;
  rimraf: (filePath: string) => Promise<void>;
  isDirEmpty: (filePath: string) => Promise<boolean>;
};

export function createSystemDirectory(...segments: string[]): SystemDirectory {
  const dirname = path.resolve(...segments);

  const resolve = (...args: string[]) => path.resolve(dirname, ...args);

  const relative = (...args: string[]) => path.relative(dirname, path.join(...args));

  const exists = (filePath: string) => existsSync(resolve(filePath));

  const read = (filePath: string) => fs.readFile(resolve(filePath), 'utf-8');

  const readSync = (filePath: string) => readFileSync(resolve(filePath), 'utf-8');

  const write = async (filePath: string, content: string, overwrite = false) => {
    if (!overwrite && exists(filePath)) return;

    const file = resolve(filePath);
    const dir = path.dirname(file);

    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(file, content);
  };

  const append = async (filePath: string, content: string) => {
    const file = resolve(filePath);
    if (!exists(file)) return write(file, content);
    await fs.appendFile(file, content);
  };

  const unlink = async (filePath: string) => {
    const file = resolve(filePath);
    if (exists(file)) await fs.unlink(file);
  };

  const rimraf = async (filePath: string) => {
    if (!exists(filePath)) return;
    await fs.rm(resolve(filePath), { recursive: true });
  };

  const copy = async (src: string, dest: string) => {
    const srcPath = resolve(src);
    const srcStat = await fs.stat(srcPath);
    if (srcStat.isDirectory()) {
      const files = await fs.readdir(srcPath);
      await fs.mkdir(dest, { recursive: true });
      for (const file of files) {
        const srcFile = path.resolve(srcPath, file);
        const destFile = path.resolve(dest, file);
        await copy(srcFile, destFile);
      }
    } else {
      await fs.copyFile(srcPath, dest);
    }
  };

  const isDirEmpty = async (filePath: string) => {
    if (!exists(filePath)) return true;
    const file = resolve(filePath);
    const stat = await fs.stat(file);
    return stat.isDirectory() ? (await fs.readdir(file)).length === 0 : false;
  };

  return {
    path: dirname,
    resolve,
    relative,
    exists,
    read,
    readSync,
    write,
    append,
    unlink,
    copy,
    rimraf,
    isDirEmpty,
  };
}
