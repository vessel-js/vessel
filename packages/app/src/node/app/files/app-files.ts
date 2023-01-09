import * as path from 'pathe';
import type { ServerConfig } from 'server/http/app/configure-server';

import type { App } from '../App';
import { MarkdocFiles } from './markdoc-files';
import { RouteFiles } from './route-files';

export class AppFiles {
  protected _app!: App;

  readonly routes = new RouteFiles();
  readonly markdoc = new MarkdocFiles();

  async init(app: App) {
    this._app = app;
    await Promise.all([this.routes.init(app), this.markdoc.init(app)]);
  }

  clear() {
    this.routes.clear();
    this.markdoc.clear();
  }

  get serverConfigs() {
    const configFiles = [
      this._app.dirs.app.glob(this._app.config.server.config.node)[0],
      this._app.dirs.app.glob(this._app.config.server.config.edge)[0],
    ];

    return configFiles
      .filter((filePath) => !!filePath)
      .map((filePath) => {
        const basename = path.basename(filePath);
        const absPath = this._app.dirs.app.resolve(filePath);
        return {
          path: absPath,
          type: basename.includes('node') ? 'node' : 'edge',
          viteLoader: async () =>
            (await this._app.vite.server!.ssrLoadModule(absPath)).default as ServerConfig,
        };
      });
  }

  get serverConfigGlob() {
    return [...this._app.config.server.config.node, ...this._app.config.server.config.edge];
  }
}
