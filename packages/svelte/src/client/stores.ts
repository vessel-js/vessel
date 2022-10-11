import type {
  ClientLoadedRoute,
  MarkdownFrontmatter,
  MarkdownMeta,
  Navigation,
} from '@vessel-js/app';
import type { HttpError, HttpErrorData } from '@vessel-js/app/http';
import type {
  LoadedServerData,
  LoadedStaticData,
  RouteParams,
} from '@vessel-js/app/routing';
import type {
  InferServerLoaderData,
  InferStaticLoaderData,
  ServerLoader,
  StaticLoader,
} from '@vessel-js/app/server';
import type { Readable } from 'svelte/store';

import {
  useFrontmatter,
  useMarkdown,
  useNavigation,
  useRoute,
  useRouteMatches,
  useRouteParams,
  useServerData,
  useServerError,
  useStaticData,
} from './context';

export type NavigationStore = Readable<Navigation>;
export const navigation: NavigationStore = toStore(useNavigation);

export type RouteStore = Readable<ClientLoadedRoute>;
export const route: RouteStore = toStore(useRoute);

export type RouteParamsStore<T extends RouteParams = RouteParams> = Readable<T>;
export const params: RouteParamsStore = toStore(useRouteParams);

export type RouteMatchesStore = Readable<ClientLoadedRoute[]>;
export const matches: RouteMatchesStore = toStore(useRouteMatches);

export type MarkdownStore = Readable<MarkdownMeta | undefined>;
export const markdown: MarkdownStore = toStore(useMarkdown);

export type FrontmatterStore<
  T extends MarkdownFrontmatter = MarkdownFrontmatter,
> = Readable<T>;

export const frontmatter: FrontmatterStore = toStore(useFrontmatter);

export type StaticDataStore<
  T extends StaticLoader | LoadedStaticData = LoadedStaticData,
> = Readable<InferStaticLoaderData<T>>;

export const staticData: StaticDataStore = toStore(useStaticData);

export type ServerDataStore<
  T extends ServerLoader | LoadedServerData = LoadedServerData,
> = Readable<InferServerLoaderData<T>>;

export const serverData: ServerDataStore = toStore(useServerData);

export type ServerErrorStore<T extends HttpErrorData = HttpErrorData> =
  Readable<HttpError<T>>;

export const serverError: ServerErrorStore = toStore(useServerError);

function toStore<T>(getContext: () => Readable<T>): Readable<T> {
  return { subscribe: (fn) => getContext().subscribe(fn) };
}
