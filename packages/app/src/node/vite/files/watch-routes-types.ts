import type { App } from 'node/app/App';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';

export async function watchRoutesTypes(app: App) {
  await updateRoutesTypes(app);

  if (app.config.isBuild) return;

  app.routes.onAdd(async () => {
    await updateRoutesTypes(app);
  });

  app.routes.onRemove(async () => {
    await updateRoutesTypes(app);
  });
}

const optionalRestParamRE = /\/\[\[\.\.\.(.*?)\]\].*/g;
const restParamRE = /\[\.\.\.(.*?)\].*/g;
const paramRE = /\[(.*?)\]/g;
const trailingSlashRe = /\/$/;

async function updateRoutesTypes(app: App) {
  const file = app.dirs.app.resolve('globals.d.ts');
  if (existsSync(file)) {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');

    const startLineIndex = lines.findIndex((line) => line.includes('<-- AUTOGEN_ROUTES_START -->'));

    const endLineIndex = lines.findIndex((line) => line.includes('<-- AUTOGEN_ROUTES_END -->'));

    if (startLineIndex >= 0 && endLineIndex >= 0) {
      const routes = app.routes
        .filterHasType('page')
        .map((route) =>
          route.cleanId
            .slice(1)
            .replace(optionalRestParamRE, '${string}')
            .replace(restParamRE, '${string}')
            .replace(paramRE, '${string}')
            .replace(trailingSlashRe, app.config.routes.trailingSlash ? '/' : ''),
        )
        .reverse()
        .map((path, i) => `  ${i + 1}: \`/${path}\`;`);

      const newLines = [
        ...lines.slice(0, startLineIndex + 1),
        ...routes,
        ...lines.slice(endLineIndex),
      ];

      await fs.writeFile(file, newLines.join('\n'));
    }
  }
}
