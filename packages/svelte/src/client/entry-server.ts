import App from ':virtual/vessel/svelte/app';
import type { ServerRenderer } from '@vessel-js/app/server';

import type { SvelteServerModule } from 'node';

import { createContext } from './context';
import { ROUTER_KEY } from './context-keys';

export const render: ServerRenderer = async ({ route, matches, router }) => {
  const { context, ...delegate } = createContext();
  context.set(ROUTER_KEY, router);

  delegate.route.set(route);
  delegate.matches.set(matches);

  const ssr = (App as SvelteServerModule['default']).render({}, { context });

  return {
    head: ssr.head,
    html: ssr.html,
  };
};
