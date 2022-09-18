import type {
  ClientLoadedRoute,
  MarkdownFrontmatter,
  MarkdownMeta,
  Navigation,
} from '@vessel-js/app';
import type { Readable } from 'svelte/store';

import {
  getFrontmatterStore,
  getMarkdownStore,
  getNavigationStore,
  getRouteMatchesStore,
  getRouteStore,
} from '../context';

export type NavigationStore = Readable<Navigation>;

export const navigation: NavigationStore = {
  subscribe: (fn) => getNavigationStore().subscribe(fn),
};

export type RouteStore = Readable<ClientLoadedRoute>;

export const route: RouteStore = {
  subscribe: (fn) => getRouteStore().subscribe(fn),
};

export type RouteMatchesStore = Readable<ClientLoadedRoute[]>;

export const matches: RouteMatchesStore = {
  subscribe: (fn) => getRouteMatchesStore().subscribe(fn),
};

export type MarkdownStore = Readable<MarkdownMeta | undefined>;

export const markdown: MarkdownStore = {
  subscribe: (fn) => getMarkdownStore().subscribe(fn),
};

export type FrontmatterStore = Readable<MarkdownFrontmatter>;

export const frontmatter: FrontmatterStore = {
  subscribe: (fn) => getFrontmatterStore().subscribe(fn),
};
