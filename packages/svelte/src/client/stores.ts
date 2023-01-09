import type {
  ClientLoadedRoute,
  MarkdownFrontmatter,
  MarkdownMeta,
  Navigation,
} from '@vessel-js/app';
import type { HttpError, HttpErrorData } from '@vessel-js/app/http';
import type { LoadedServerData, LoadedStaticData, RouteParams } from '@vessel-js/app/routing';
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

export interface NavigationStore extends Readable<Navigation> {}
export const navigation: NavigationStore = toStore(useNavigation);

export interface RouteStore extends Readable<ClientLoadedRoute> {}
export const route: RouteStore = toStore(useRoute);

export interface RouteParamsStore<T extends RouteParams = RouteParams> extends Readable<T> {}
export const params: RouteParamsStore = toStore(useRouteParams);

export interface RouteMatchesStore extends Readable<ClientLoadedRoute[]> {}
export const matches: RouteMatchesStore = toStore(useRouteMatches);

export interface MarkdownStore extends Readable<MarkdownMeta | undefined> {}
export const markdown: MarkdownStore = toStore(useMarkdown);

export interface FrontmatterStore<T extends MarkdownFrontmatter = MarkdownFrontmatter>
  extends Readable<T> {}

export const frontmatter: FrontmatterStore = toStore(useFrontmatter);

export interface StaticDataStore<T extends StaticLoader | LoadedStaticData = LoadedStaticData>
  extends Readable<InferStaticLoaderData<T>> {}

export const staticData: StaticDataStore = toStore(useStaticData);

export interface ServerDataStore<T extends ServerLoader | LoadedServerData = LoadedServerData>
  extends Readable<InferServerLoaderData<T>> {}

export const serverData: ServerDataStore = toStore(useServerData);

export interface ServerErrorStore<T extends HttpErrorData = HttpErrorData>
  extends Readable<HttpError<T>> {}

export const serverError: ServerErrorStore = toStore(useServerError);

function toStore<T>(getContext: () => Readable<T>): Readable<T> {
  return { subscribe: (fn) => getContext().subscribe(fn) };
}
