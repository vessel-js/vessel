import { init, tick } from '@vessel-js/app';
import { type JSX } from 'solid-js';
import { hydrate } from 'solid-js/web';

import VesselApp from ':virtual/vessel/app';

import { createContext, VesselContext } from './context';
import { ROUTER_KEY } from './context-keys';

async function main() {
  const { context, ...delegate } = createContext();

  const router = await init({
    frameworkDelegate: {
      tick,
      ...delegate,
    },
  });

  context.set(ROUTER_KEY, router);

  await router.start((target) => {
    const App = VesselApp.module.default as () => JSX.Element;
    hydrate(
      () =>
        VesselContext.Provider({
          value: context,
          get children() {
            return App();
          },
        }),
      target,
    );
  });
}

main();
