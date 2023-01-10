import fs from 'node:fs';
import fsp from 'node:fs/promises';

import kleur from 'kleur';
import ora from 'ora';
import * as path from 'pathe';

import { ensureDir, LoggerIcon, type App } from 'node';
import { STATIC_DATA_ASSET_BASE_PATH } from 'shared/data';
import { escapeHTML } from 'shared/utils/html';
import { isString } from 'shared/utils/unit';

import type { BuildData } from './build-data';

export function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}

export function formatWritingFilesTitle(type: string, word: string, count: number) {
  return `Writing ${kleur.underline(count)} ${type} ${pluralize(word, count)}...`;
}

export function formatCommittedFilesTitle(type: string, word: string, count: number) {
  return `Committed ${kleur.underline(count)} ${type} ${pluralize(word, count)}`;
}

export function resolveHTMLFilename(url: URL) {
  const decodedRoute = decodeURI(isString(url) ? url : url.pathname);
  const filePath = decodedRoute.replace(/\/$|$/, '/index.html');
  return filePath.slice(1);
}

export function resolveDataFilename(name: string) {
  return `${STATIC_DATA_ASSET_BASE_PATH}/${name}.json`.slice(1);
}

export function createStaticDataScriptTag(dataAssetIds: Set<string> | undefined, build: BuildData) {
  if (!dataAssetIds) return '';

  const table: Record<string, unknown> = {};

  for (const id of dataAssetIds) {
    const data = build.static.data.get(id)!;
    if (data && Object.keys(data.data).length > 0) {
      table[data.contentHash] = data.data;
    }
  }

  if (Object.keys(table).length === 0) return '';

  return [
    '<script>',
    `__VSL_STATIC_DATA__ = JSON.parse(${JSON.stringify(JSON.stringify(table))});`,
    '</script>',
  ].join('');
}

export function createRedirectMetaTag(url: string) {
  return `<meta http-equiv="refresh" content="${escapeHTML(`0;url=${url}`)}">`;
}

export function guessPackageManager(app: App): 'npm' | 'yarn' | 'pnpm' {
  if (fs.existsSync(app.dirs.root.resolve('pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (fs.existsSync(app.dirs.root.resolve('yarn.lock'))) {
    return 'yarn';
  }

  return 'npm';
}

export async function findPreviewScriptName(app: App) {
  try {
    const packageJson = app.dirs.root.resolve('package.json');
    if (fs.existsSync(packageJson)) {
      const content = fs.readFileSync(packageJson, 'utf-8');
      const json = JSON.parse(content);

      const script = Object.keys(json.scripts ?? {}).find((script) => {
        return json.scripts[script].includes('vite preview');
      });

      return script;
    }
  } catch (e) {
    //
  }

  return null;
}

export async function writeFiles(
  files: Map<string, string>,
  resolveFilePath: (filename: string) => string,
  resolvePendingMessage: (count: number) => string,
  resolveSuccessMessage: (count: number) => string,
) {
  if (files.size === 0) return;

  const writingSpinner = ora();
  const pendingMessage = resolvePendingMessage?.(files.size);
  const successMessage = resolveSuccessMessage?.(files.size);

  writingSpinner.start(kleur.bold(pendingMessage));

  await Promise.all(
    Array.from(files.keys()).map(async (filename) => {
      const filePath = resolveFilePath(filename);
      const content = files.get(filename)!;
      await ensureDir(path.dirname(filePath));
      await fsp.writeFile(filePath, content);
    }),
  );

  writingSpinner.stopAndPersist({
    text: kleur.bold(successMessage),
    symbol: LoggerIcon.Success,
  });
}
