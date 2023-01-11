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
  createEffect,
  createRoot,
  createSignal,
  createContext as createSolidContext,
  useContext,
  type Accessor,
  type Signal,
} from 'solid-js';

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

/** @internal */
export interface VesselContextMap extends Map<string | symbol, unknown> {}

/** @internal */
export const VesselContext = createSolidContext<VesselContextMap>();

/** @internal */
export function useVesselContext(): VesselContextMap {
  return useContext(VesselContext)!;
}

export function useRouter() {
  return useVesselContext().get(ROUTER_KEY) as Router;
}

export interface RouteSignal extends Accessor<ClientLoadedRoute> {}

export function useRoute() {
  return useVesselContext().get(ROUTE_KEY) as RouteSignal;
}

export interface RouteMatchesAccessor extends Accessor<ClientLoadedRoute[]> {}

export function useRouteMatches() {
  return useVesselContext().get(ROUTE_MATCHES_KEY) as RouteMatchesAccessor;
}

export interface RouteParamsAccessor<T extends RouteParams = RouteParams> extends Accessor<T> {}

export function useRouteParams<T extends RouteParams = RouteParams>() {
  return useVesselContext().get(ROUTE_PARAMS_KEY) as RouteParamsAccessor<T>;
}

export interface NavigationAccessor extends Accessor<Navigation> {}

export function useNavigation() {
  return useVesselContext().get(NAVIGATION_KEY) as NavigationAccessor;
}

export interface MarkdownAccessor extends Accessor<MarkdownMeta | undefined> {}

export function useMarkdown() {
  return useVesselContext().get(MARKDOWN_KEY) as MarkdownAccessor;
}

export interface FrontmatterAccessor<T extends MarkdownFrontmatter = MarkdownFrontmatter>
  extends Accessor<T> {}

export function useFrontmatter<T extends MarkdownFrontmatter = MarkdownFrontmatter>() {
  return useVesselContext().get(FRONTMATTER_KEY) as FrontmatterAccessor<T>;
}

export interface StaticDataAccessor<T extends StaticLoader | LoadedStaticData = LoadedStaticData>
  extends Accessor<InferStaticLoaderData<T>> {}

export function useStaticData<
  T extends StaticLoader | LoadedStaticData = LoadedStaticData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(loader?: T) {
  return useVesselContext().get(STATIC_DATA_KEY) as StaticDataAccessor<InferStaticLoaderData<T>>;
}

export interface ServerDataAccessor<T extends ServerLoader | LoadedServerData = LoadedServerData>
  extends Accessor<InferServerLoaderData<T>> {}

export function useServerData<
  T extends ServerLoader | LoadedServerData = LoadedServerData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(loader?: T) {
  return useVesselContext().get(SERVER_DATA_KEY) as ServerDataAccessor<InferServerLoaderData<T>>;
}

export interface ServerErrorAccessor<T extends HttpErrorData = HttpErrorData>
  extends Accessor<HttpError<T>> {}

export function useServerError<T extends HttpErrorData = HttpErrorData>() {
  return useVesselContext().get(SERVER_ERROR_KEY) as ServerErrorAccessor<T>;
}

export function createContext() {
  const signals = {
    [ROUTE_KEY]: createSignal<any>(),
    [ROUTE_MATCHES_KEY]: createSignal<any[]>([]),
    [NAVIGATION_KEY]: createSignal<Navigation | null>(null),
  };

  signals[MARKDOWN_KEY] = createMarkdownSignal(signals[ROUTE_KEY][0]);
  signals[FRONTMATTER_KEY] = createFrontmatterSignal(signals[MARKDOWN_KEY]);

  const context: VesselContextMap = new Map();

  for (const key of Object.getOwnPropertySymbols(signals)) {
    context.set(key, Array.isArray(signals[key]) ? signals[key][0] : signals[key]);
  }

  const headManager = createHeadManager();
  context.set(HEAD_MANAGER, headManager);

  return {
    headManager,
    context,
    route: createReactive(signals[ROUTE_KEY]),
    matches: createReactive(signals[ROUTE_MATCHES_KEY]),
    navigation: createReactive(signals[NAVIGATION_KEY]),
  };
}

function createReactive<T>([get, set]: Signal<T>): Reactive<T> {
  return {
    get,
    set,
    subscribe: (onUpdate) => {
      return createRoot((dispose) => {
        createEffect(() => {
          onUpdate(get());
        });

        return dispose;
      });
    },
  };
}

function createMarkdownSignal(route: RouteSignal): MarkdownAccessor {
  return () => {
    const page = route().page;
    return page && isMarkdownModule(page.module) ? page.module.meta : undefined;
  };
}

function createFrontmatterSignal(markdown: MarkdownAccessor): FrontmatterAccessor {
  return () => markdown()?.frontmatter ?? {};
}
