import {
  isMarkdownModule,
  type MarkdownFrontmatter,
  type Navigation,
  type Reactive,
  type Router,
} from '@vessel-js/app';
import type { HttpErrorData } from '@vessel-js/app/http';
import type {
  LoadedServerData,
  LoadedStaticData,
  RouteParams,
} from '@vessel-js/app/routing';
import { getContext } from 'svelte';
import {
  derived,
  get,
  type Readable,
  type Writable,
  writable,
} from 'svelte/store';

import {
  FRONTMATTER_KEY,
  MARKDOWN_KEY,
  NAVIGATION_KEY,
  ROUTE_KEY,
  ROUTE_MATCHES_KEY,
  ROUTE_PARAMS_KEY,
  ROUTER_KEY,
  SERVER_DATA_KEY,
  SERVER_ERROR_KEY,
  STATIC_DATA_KEY,
} from './context-keys';
import type {
  FrontmatterStore,
  MarkdownStore,
  NavigationStore,
  RouteMatchesStore,
  RouteParamsStore,
  RouteStore,
  ServerDataStore,
  ServerErrorStore,
  StaticDataStore,
} from './stores';

export function useRouter(): Router {
  return getContext(ROUTER_KEY);
}

export function useRoute(): RouteStore {
  return getContext(ROUTE_KEY);
}
export function useRouteParams<
  T extends RouteParams = RouteParams,
>(): RouteParamsStore<T> {
  return getContext(ROUTE_PARAMS_KEY);
}

export function useRouteMatches(): RouteMatchesStore {
  return getContext(ROUTE_MATCHES_KEY);
}

export function useNavigation(): NavigationStore {
  return getContext(NAVIGATION_KEY);
}

export function useMarkdown(): MarkdownStore {
  return getContext(MARKDOWN_KEY);
}

export function useFrontmatter<
  T extends MarkdownFrontmatter = MarkdownFrontmatter,
>(): FrontmatterStore<T> {
  return getContext(FRONTMATTER_KEY);
}

export function useStaticData<
  T extends LoadedStaticData = LoadedStaticData,
>(): StaticDataStore<T> {
  return getContext(STATIC_DATA_KEY);
}

export function useServerData<
  T extends LoadedServerData = LoadedServerData,
>(): ServerDataStore<T> {
  return getContext(SERVER_DATA_KEY);
}

export function useServerError<
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
    route: createReactive(stores[ROUTE_KEY]),
    matches: createReactive(stores[ROUTE_MATCHES_KEY]),
    navigation: createReactive(stores[NAVIGATION_KEY]),
  };
}

function createReactive<T>(store: Readable<T> | Writable<T>): Reactive<T> {
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
