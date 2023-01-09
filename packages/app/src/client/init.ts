import config from ':virtual/vessel/config';
import manifest from ':virtual/vessel/manifest';
import type { MarkdownMeta } from 'shared/markdown';
import { installURLPattern } from 'shared/polyfills';
import {
  getRouteComponentTypes,
  type LoadableRouteComponent,
  type RouteComponentType,
} from 'shared/routing';

import { Router, type ClientLoadableRoute, type RouterFrameworkDelegate } from './router';
import type { ClientManifest } from './router/types';
import { isMarkdownModule } from './utils';

export interface ClientInitOptions {
  frameworkDelegate: RouterFrameworkDelegate;
}

export async function init({ frameworkDelegate }: ClientInitOptions) {
  await installURLPattern();

  const router = new Router({
    baseUrl: config.baseUrl,
    trailingSlash: window['__VSL_TRAILING_SLASH__'],
    frameworkDelegate,
  });

  if (import.meta.env.PROD) {
    const redirects = window['__VSL_STATIC_REDIRECTS_MAP__'] ?? {};
    for (const from of Object.keys(redirects)) {
      const to = redirects[from];
      router.addRedirect(from, to);
    }
  }

  readManifest(router, manifest);

  if (import.meta.hot) {
    import.meta.hot.on(
      'vessel::md_meta',
      ({ id, type, meta }: { id: string; type: RouteComponentType; meta: MarkdownMeta }) => {
        const route = frameworkDelegate.route.get();
        if (!route[type]) return;
        if (isMarkdownModule(route[type]!.module) && route.id === id) {
          const component = route[type]!;
          frameworkDelegate.route.set({
            ...route,
            [type]: {
              ...component,
              module: {
                ...component.module,
                __markdownMeta: meta,
              },
            },
          });
        }
      },
    );

    frameworkDelegate.route.subscribe((route) => {
      if (route) {
        import.meta.hot!.send('vessel::route_change', { id: route.id });
      }
    });

    import.meta.hot.accept('/:virtual/vessel/manifest', (mod) => {
      handleManifestChange(router, mod?.default);
    });
  }

  return router;
}

const routeIds = new Set<string>();

function readManifest(router: Router, { loaders, fetch, routes }: ClientManifest) {
  let loaderIndex = 0;
  const clientRoutes: ClientLoadableRoute[] = [];

  const typeKeyMap: Record<RouteComponentType, string> = {
    page: 'p',
    layout: 'l',
    errorBoundary: 'e',
  };

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const [id, pathname, score] = route.u;

    const newRoute = {
      id,
      pathname,
      score,
      pattern: new URLPattern({ pathname }),
    };

    for (const type of getRouteComponentTypes()) {
      if (route[typeKeyMap[type]]) {
        newRoute[type] = {
          loader: loaders[loaderIndex++],
          canFetch: fetch.includes(loaderIndex),
          stale: true,
        } as LoadableRouteComponent;
      }
    }

    clientRoutes.push(newRoute);
    if (import.meta.hot) routeIds.add(id!);
  }

  router.addAll(clientRoutes);
}

function handleManifestChange(router: Router, manifest?: ClientManifest) {
  if (import.meta.hot) {
    for (const id of routeIds) {
      router.remove(id);
      routeIds.delete(id);
    }

    if (manifest) readManifest(router, manifest);
  }
}
