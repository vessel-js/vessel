import App from ':virtual/vessel/solid/app';
import { renderHeadToString } from '@vessel-js/app/head';
import type { ServerRenderer } from '@vessel-js/app/server';
import { generateHydrationScript, renderToString } from 'solid-js/web';

import { createContext, VesselContext } from './context';
import { ROUTER_KEY } from './context-keys';

export const render: ServerRenderer = async ({ route, matches, router }) => {
  const { context, headManager, ...delegate } = createContext();
  context.set(ROUTER_KEY, router);

  delegate.route.set(route);
  delegate.matches.set(matches);

  const html = await renderToString(() => (
    <VesselContext.Provider value={context}>
      <App />
    </VesselContext.Provider>
  ));

  const headSSR = renderHeadToString(headManager);

  return {
    ...headSSR,
    head: headSSR.head + generateHydrationScript(),
    html,
  };
};
