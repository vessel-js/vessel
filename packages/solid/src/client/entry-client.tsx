import App from ':virtual/vessel/solid/app';
import { init, tick } from '@vessel-js/app';
import { hydrate } from 'solid-js/web';

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
    hydrate(
      () => (
        <VesselContext.Provider value={context}>
          <App />
        </VesselContext.Provider>
      ),
      target,
    );
  });
}

main();
