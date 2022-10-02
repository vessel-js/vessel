import type {
  ClientLoadedRoute,
  HttpError,
  HttpErrorData,
  LoadedServerData,
  LoadedStaticData,
  MarkdownFrontmatter,
  MarkdownMeta,
  Navigation,
  RouteParams,
} from '@vessel-js/app';
import type { Readable } from 'svelte/store';

import {
  getFrontmatter,
  getMarkdown,
  getNavigation,
  getRoute,
  getRouteMatches,
  getRouteParams,
  getServerData,
  getServerError,
  getStaticData,
} from './context';

export type NavigationStore = Readable<Navigation>;
export const navigation: NavigationStore = toStore(getNavigation);

export type RouteStore = Readable<ClientLoadedRoute>;
export const route: RouteStore = toStore(getRoute);

export type RouteParamsStore<T extends RouteParams = RouteParams> = Readable<T>;
export const params: RouteParamsStore = toStore(getRouteParams);

export type RouteMatchesStore = Readable<ClientLoadedRoute[]>;
export const matches: RouteMatchesStore = toStore(getRouteMatches);

export type MarkdownStore = Readable<MarkdownMeta | undefined>;
export const markdown: MarkdownStore = toStore(getMarkdown);

export type FrontmatterStore<
  T extends MarkdownFrontmatter = MarkdownFrontmatter,
> = Readable<T>;
export const frontmatter: FrontmatterStore = toStore(getFrontmatter);

export type StaticDataStore<T extends LoadedStaticData = LoadedStaticData> =
  Readable<T>;
export const staticData: StaticDataStore = toStore(getStaticData);

export type ServerDataStore<T extends LoadedServerData = LoadedServerData> =
  Readable<T>;
export const serverData: ServerDataStore = toStore(getServerData);

export type ServerErrorStore<T extends HttpErrorData = HttpErrorData> =
  Readable<HttpError<T>>;
export const serverError: ServerErrorStore = toStore(getServerError);

function toStore<T>(getContext: () => Readable<T>): Readable<T> {
  return { subscribe: (fn) => getContext().subscribe(fn) };
}
