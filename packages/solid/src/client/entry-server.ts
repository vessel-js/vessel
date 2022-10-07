import { renderHeadToString } from '@vessel-js/app/head';
import type { ServerRenderer } from '@vessel-js/app/server';
import { type JSX } from 'solid-js';
import { generateHydrationScript, renderToString } from 'solid-js/web';

import VesselApp from ':virtual/vessel/app';

import { createContext, VesselContext } from './context';
import { ROUTER_KEY } from './context-keys';

export const render: ServerRenderer = async ({ route, matches, router }) => {
  const { context, headManager, ...delegate } = createContext();
  context.set(ROUTER_KEY, router);

  delegate.route.set(route);
  delegate.matches.set(matches);

  const App = VesselApp.module.default as () => JSX.Element;

  const html = await renderToString(() =>
    VesselContext.Provider({
      value: context,
      get children() {
        return App();
      },
    }),
  );

  const headSSR = renderHeadToString(headManager);

  return {
    ...headSSR,
    head: headSSR.head + generateHydrationScript(),
    html,
  };
};
