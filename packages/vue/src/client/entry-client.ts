import App from ':virtual/vessel/vue/app';
import { init } from '@vessel-js/app';
import { createSSRApp, nextTick } from 'vue';

import { createContext } from './context';
import { ROUTER_KEY } from './context-keys';

async function main() {
  const { context, ...delegate } = createContext();

  const router = await init({
    frameworkDelegate: {
      tick: nextTick,
      ...delegate,
    },
  });

  context.set(ROUTER_KEY, router);

  await router.start((target) => {
    const app = createSSRApp(App);
    for (const [key, value] of context) app.provide(key, value);
    app.mount(target, true);
  });
}

main();
