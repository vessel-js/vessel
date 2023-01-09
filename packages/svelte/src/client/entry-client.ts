import App from ':virtual/vessel/svelte/app';
import { init } from '@vessel-js/app';
import { tick } from 'svelte';

import type { SvelteModule } from '../shared';
import { createContext } from './context';
import { ROUTER_KEY } from './context-keys';

async function main() {
  const { context, ...delegate } = createContext();

  const router = await init({
    frameworkDelegate: { tick, ...delegate },
  });

  context.set(ROUTER_KEY, router);

  await router.start((target) => {
    new (App as SvelteModule['default'])({ target, context, hydrate: true });
  });
}

main();
