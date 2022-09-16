import type { ServerModule } from 'server';
import type { Route } from 'shared/routing';

import type { App } from '../App';
import type { PageFile } from '../files';
import { type SystemFileRoute, SystemFileRoutes } from './SystemFileRoutes';

export type PageFileRoute = SystemFileRoute<PageFile>;

export class PageFileRoutes extends SystemFileRoutes<PageFile> {
  protected _type: Route['type'] = 'page';

  init(app: App): void {
    super.init(app);
    this._watch(app.files.pages);
  }
}

export function resolvePageSegments(app: App, page: PageFileRoute) {
  return [
    ...page.file.layouts.map((file) => app.routes.layouts.getByFile(file)),
    page,
  ];
}

export function createLoadablePageSegments(
  app: App,
  page: PageFileRoute,
  load: (route: SystemFileRoute) => Promise<ServerModule>,
) {
  return resolvePageSegments(app, page).map((route) => ({
    ...route,
    loader: () => load(route),
  }));
}
