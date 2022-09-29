import { init } from '@vessel-js/app';
import { createSSRApp, type DefineComponent, nextTick } from 'vue';

import App from ':virtual/vessel/app';

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
    const mod = App.module as { default: DefineComponent };
    const app = createSSRApp(mod.default);
    for (const [key, value] of context) app.provide(key, value);
    app.mount(target, true);
  });
}

main();
