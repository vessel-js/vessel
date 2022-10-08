import type { ServerRenderer } from '@vessel-js/app/server';
import type { SvelteServerModule } from 'node';

import App from ':virtual/vessel/app';

import { createContext } from './context';
import { ROUTER_KEY } from './context-keys';

export const render: ServerRenderer = async ({ route, matches, router }) => {
  const { context, ...delegate } = createContext();
  context.set(ROUTER_KEY, router);

  delegate.route.set(route);
  delegate.matches.set(matches);

  const mod = App.module as SvelteServerModule;
  const ssr = mod.default.render({}, { context });

  return {
    head: ssr.head,
    html: ssr.html,
  };
};
