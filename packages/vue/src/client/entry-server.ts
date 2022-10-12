import { renderHeadToString } from '@vessel-js/app/head';
import type { ServerRenderer } from '@vessel-js/app/server';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

import App from ':virtual/vessel/vue/app';

import { createContext } from './context';
import { ROUTER_KEY } from './context-keys';

export const render: ServerRenderer = async ({ route, matches, router }) => {
  const { context, headManager, ...delegate } = createContext();
  context.set(ROUTER_KEY, router);

  delegate.route.set(route);
  delegate.matches.set(matches);

  const app = createSSRApp(App);
  for (const [key, value] of context) app.provide(key, value);

  // TODO: does ctx.modules contain modules not already included in manfiest?
  const ctx = { modules: new Set() };

  const html = await renderToString(app, ctx);
  const headSSR = renderHeadToString(headManager);

  return { ...headSSR, html };
};
