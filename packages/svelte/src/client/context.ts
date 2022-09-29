import {
  type HttpErrorData,
  isMarkdownModule,
  type LoadedServerData,
  type LoadedStaticData,
  MarkdownFrontmatter,
  type Navigation,
  type Reactive,
  type Router,
} from '@vessel-js/app';
import { getContext } from 'svelte';
import {
  derived,
  get,
  type Readable,
  type Writable,
  writable,
} from 'svelte/store';

import type {
  FrontmatterStore,
  MarkdownStore,
  NavigationStore,
  RouteMatchesStore,
  RouteStore,
  ServerDataStore,
  ServerErrorStore,
  StaticDataStore,
} from './stores';

export const ROUTER_KEY = Symbol();
export function getRouter(): Router {
  return getContext(ROUTER_KEY);
}

const ROUTE_KEY = Symbol();
export function getRoute(): RouteStore {
  return getContext(ROUTE_KEY);
}

const ROUTE_MATCHES_KEY = Symbol();
export function getRouteMatches(): RouteMatchesStore {
  return getContext(ROUTE_MATCHES_KEY);
}

const NAVIGATION_KEY = Symbol();
export function getNavigation(): NavigationStore {
  return getContext(NAVIGATION_KEY);
}

const MARKDOWN_KEY = Symbol();
export function getMarkdown(): MarkdownStore {
  return getContext(MARKDOWN_KEY);
}

const FRONTMATTER_KEY = Symbol();
export function getFrontmatter<
  T extends MarkdownFrontmatter = MarkdownFrontmatter,
>(): FrontmatterStore<T> {
  return getContext(FRONTMATTER_KEY);
}

export const STATIC_DATA_KEY = Symbol();
export function getStaticData<
  T extends LoadedStaticData = LoadedStaticData,
>(): StaticDataStore<T> {
  return getContext(STATIC_DATA_KEY);
}

export const SERVER_DATA_KEY = Symbol();
export function getServerData<
  T extends LoadedServerData = LoadedServerData,
>(): ServerDataStore<T> {
  return getContext(SERVER_DATA_KEY);
}

export const SERVER_ERROR_KEY = Symbol();
export function getServerError<
  T extends HttpErrorData = HttpErrorData,
>(): ServerErrorStore<T> {
  return getContext(SERVER_ERROR_KEY);
}

export function createContext() {
  const stores = {
    [ROUTE_KEY]: writable<any>(),
    [ROUTE_MATCHES_KEY]: writable<any[]>([]),
    [NAVIGATION_KEY]: writable<Navigation>(),
  };

  stores[MARKDOWN_KEY] = createMarkdownStore(stores[ROUTE_KEY]);
  stores[FRONTMATTER_KEY] = createFrontmatterStore(stores[MARKDOWN_KEY]);

  const context = new Map<string | symbol, unknown>();
  for (const key of Object.getOwnPropertySymbols(stores)) {
    context.set(key, { subscribe: stores[key].subscribe });
  }

  return {
    context,
    route: toReactive(stores[ROUTE_KEY]),
    matches: toReactive(stores[ROUTE_MATCHES_KEY]),
    navigation: toReactive(stores[NAVIGATION_KEY]),
  };
}

export function toReactive<T>(store: Readable<T> | Writable<T>): Reactive<T> {
  return {
    get: () => get(store),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    set: 'set' in store ? store.set : () => {},
    subscribe: store.subscribe,
  };
}

function createMarkdownStore(route: RouteStore): MarkdownStore {
  return derived(route, ($route) =>
    $route.page && isMarkdownModule($route.page.module)
      ? $route.page.module.__markdownMeta
      : undefined,
  );
}

function createFrontmatterStore(markdown: MarkdownStore): FrontmatterStore {
  return derived(markdown, ($markdown) => $markdown?.frontmatter ?? {});
}
