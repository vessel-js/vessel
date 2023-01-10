import fs from 'node:fs';

import type { App } from 'node/app/App';

export const DEFAULT_INDEX_HTML = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="generator" content="vessel@{{ version }}" />
    <!--@vessel/head-->
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="app">
      <!--@vessel/app-->
    </div>
    <!--@vessel/body-->
  </body>
</html>
`;

export function readIndexHtmlFile(app: App): string {
  const indexPath = app.dirs.app.resolve('index.html');

  const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : DEFAULT_INDEX_HTML;

  return html.replace('{{ version }}', app.version);
}
