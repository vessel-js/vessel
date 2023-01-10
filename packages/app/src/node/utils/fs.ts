import { createHash } from 'node:crypto';
import fs from 'node:fs';

import * as path from 'pathe';

export const isTypeScriptFile = (filePath: string): boolean => /\.(ts|tsx)($|\?)/.test(filePath);

export const isCommonJsFile = (filePath: string): boolean => /\.cjs($|\?)/.test(filePath);

export function checksumFile(algorithm: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = fs.createReadStream(path);
    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function copyDir(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file);
    const destFile = path.resolve(destDir, file);
    copyFile(srcFile, destFile);
  }
}

export async function ensureDir(dir: string) {
  if (fs.existsSync(dir)) return;
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function ensureFile(filePath: string) {
  if (fs.existsSync(filePath)) return;
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, '', { encoding: 'utf-8' });
}

export function copyFile(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDir(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
}

export function mkdirp(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if ((e as any).code === 'EEXIST') return;
    throw e;
  }
}

export function rimraf(path: string) {
  if (fs.existsSync(path)) {
    fs.rmSync(path, { recursive: true });
  }
}
