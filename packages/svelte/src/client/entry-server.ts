import type { ServerRenderer } from '@vessel-js/app/server';
import type { SvelteServerModule } from 'node';

import App from ':virtual/vessel/app';

import { createContext, ROUTER_KEY } from './context';

export const render: ServerRenderer = async ({ route, matches, router }) => {
  const { context, ...delegate } = createContext();
  context.set(ROUTER_KEY, router);

  delegate.route.set(route);
  delegate.matches.set(matches);

  const mod = App.module as SvelteServerModule;
  return mod.default.render({}, { context });
};
