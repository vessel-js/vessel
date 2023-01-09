import {
  isMarkdownModule,
  type ClientLoadedRoute,
  type MarkdownFrontmatter,
  type MarkdownMeta,
  type Navigation,
  type Reactive,
  type Router,
} from '@vessel-js/app';
import { createHeadManager } from '@vessel-js/app/head';
import type { HttpError, HttpErrorData } from '@vessel-js/app/http';
import type { LoadedServerData, LoadedStaticData, RouteParams } from '@vessel-js/app/routing';
import type {
  InferServerLoaderData,
  InferStaticLoaderData,
  ServerLoader,
  StaticLoader,
} from '@vessel-js/app/server';
import {
  computed,
  inject,
  isReadonly,
  readonly,
  ref,
  watchEffect,
  type ComputedRef,
  type Ref,
} from 'vue';

import {
  FRONTMATTER_KEY,
  HEAD_MANAGER,
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

export function useRouter(): Router {
  return inject(ROUTER_KEY)!;
}

export interface RouteRef extends Readonly<Ref<ClientLoadedRoute>> {}

export function useRoute(): RouteRef {
  return inject(ROUTE_KEY)!;
}

export interface RouteMatchesRef extends Readonly<Ref<ClientLoadedRoute[]>> {}

export function useRouteMatches(): RouteMatchesRef {
  return inject(ROUTE_MATCHES_KEY)!;
}

export interface RouteParamsRef<T extends RouteParams = RouteParams> extends Readonly<Ref<T>> {}

export function useRouteParams<T extends RouteParams = RouteParams>(): RouteParamsRef<T> {
  return inject(ROUTE_PARAMS_KEY)!;
}

export interface NavigationRef extends Readonly<Ref<Navigation>> {}

export function useNavigation(): NavigationRef {
  return inject(NAVIGATION_KEY)!;
}

export interface MarkdownRef extends ComputedRef<MarkdownMeta | undefined> {}

export function useMarkdown(): MarkdownRef {
  return inject(MARKDOWN_KEY)!;
}

export interface FrontmatterRef<T extends MarkdownFrontmatter = MarkdownFrontmatter>
  extends ComputedRef<T> {}

export function useFrontmatter<
  T extends MarkdownFrontmatter = MarkdownFrontmatter,
>(): FrontmatterRef<T> {
  return inject(FRONTMATTER_KEY)!;
}

export interface StaticDataRef<T extends StaticLoader | LoadedStaticData = LoadedStaticData>
  extends Readonly<Ref<InferStaticLoaderData<T>>> {}

export function useStaticData<
  T extends StaticLoader | LoadedStaticData = LoadedStaticData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(loader?: T): StaticDataRef<InferStaticLoaderData<T>> {
  return inject(STATIC_DATA_KEY)!;
}

export interface ServerDataRef<T extends ServerLoader | LoadedServerData = LoadedServerData>
  extends Readonly<Ref<InferServerLoaderData<T>>> {}

export function useServerData<
  T extends ServerLoader | LoadedServerData = LoadedServerData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(loader?: T): ServerDataRef<InferServerLoaderData<T>> {
  return inject(SERVER_DATA_KEY)!;
}

export interface ServerErrorRef<T extends HttpErrorData = HttpErrorData>
  extends Readonly<Ref<HttpError<T>>> {}

export function useServerError<T extends HttpErrorData = HttpErrorData>(): ServerErrorRef<T> {
  return inject(SERVER_ERROR_KEY)!;
}

export function createContext() {
  const refs = {
    [ROUTE_KEY]: ref<any>(),
    [ROUTE_MATCHES_KEY]: ref<any[]>([]),
    [NAVIGATION_KEY]: ref<Navigation>(null),
  };

  refs[MARKDOWN_KEY] = createMarkdownStore(refs[ROUTE_KEY]);
  refs[FRONTMATTER_KEY] = createFrontmatterStore(refs[MARKDOWN_KEY]);

  const context = new Map<string | symbol, unknown>();
  for (const key of Object.getOwnPropertySymbols(refs)) {
    context.set(key, readonly(refs[key]));
  }

  const headManager = createHeadManager();
  context.set(HEAD_MANAGER, headManager);

  return {
    headManager,
    context,
    route: createReactive(refs[ROUTE_KEY]),
    matches: createReactive(refs[ROUTE_MATCHES_KEY]),
    navigation: createReactive(refs[NAVIGATION_KEY]),
  };
}

function createReactive<T>(ref: Ref<T> | ComputedRef<T>): Reactive<T> {
  return {
    get: () => ref.value,
    set: (value) => {
      if (!isReadonly(ref)) {
        (ref as Ref<T>).value = value;
      }
    },
    subscribe: (onUpdate) => {
      return watchEffect(() => {
        onUpdate(ref.value);
      });
    },
  };
}

function createMarkdownStore(route: RouteRef): MarkdownRef {
  return computed(() =>
    route.value.page && isMarkdownModule(route.value.page.module)
      ? route.value.page.module.__markdownMeta
      : undefined,
  );
}

function createFrontmatterStore(markdown: MarkdownRef): FrontmatterRef {
  return computed(() => markdown.value?.frontmatter ?? {});
}
