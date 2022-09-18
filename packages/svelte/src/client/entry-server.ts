import type { ServerRenderer } from '@vessel-js/app/server';

export const render: ServerRenderer = async ({ routes }) => {
  // const serverContext: ServerEntryContext = {};

  // const { router, context } = await initClient();

  // await router.go(decodeURI(url.pathname));

  // const mod = app.module as SvelteServerModule;
  // const { head, html, css } = await mod.default.render({}, { context });

  return {
    html: '',
    head: '',
    css: '',
  };
};
