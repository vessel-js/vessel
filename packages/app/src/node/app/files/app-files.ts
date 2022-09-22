import { type App } from '../App';
import { MarkdocFiles } from './markdoc-files';
import { RouteFiles } from './route-files';

export class AppFiles {
  routes = new RouteFiles();
  markdoc = new MarkdocFiles();

  async init(app: App) {
    await Promise.all([this.routes.init(app), this.markdoc.init(app)]);
  }

  clear() {
    this.routes.clear();
    this.markdoc.clear();
  }
}
