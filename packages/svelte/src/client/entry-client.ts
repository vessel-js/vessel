import { init } from '@vessel-js/app';
import { tick } from 'svelte';

import App from ':virtual/vessel/app';

import { type SvelteModule } from '../shared';
import { createContext, ROUTER_KEY } from './context';

async function main() {
  const { context, ...delegate } = createContext();

  const router = await init({
    frameworkDelegate: { tick, ...delegate },
  });

  context.set(ROUTER_KEY, router);

  await router.start((target) => {
    const mod = App.module as SvelteModule;
    new mod.default({ target, context, hydrate: true });
  });
}

main();
