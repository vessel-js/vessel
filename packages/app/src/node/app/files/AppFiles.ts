import { type App } from '../App';
import { MarkdocFiles } from './MarkdocFiles';
import { RouteFiles } from './RouteFiles';

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
