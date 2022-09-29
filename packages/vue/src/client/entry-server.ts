import { renderHeadToString } from '@vessel-js/app/head';
import type { ServerRenderer } from '@vessel-js/app/server';
import { type Component, createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

import App from ':virtual/vessel/app';

import { createContext } from './context';
import { ROUTER_KEY } from './context-keys';

export const render: ServerRenderer = async ({ route, matches, router }) => {
  const { context, headManager, ...delegate } = createContext();
  context.set(ROUTER_KEY, router);

  delegate.route.set(route);
  delegate.matches.set(matches);

  const mod = App.module as { default: Component };
  const app = createSSRApp(mod.default);
  for (const [key, value] of context) app.provide(key, value);

  // TODO: does ctx.modules contain modules not already included in manfiest?
  const ctx = { modules: new Set() };

  const html = await renderToString(app, ctx);
  const headSSR = renderHeadToString(headManager);

  return { ...headSSR, html };
};
