/**
 * Initially inspired by:
 * - SvelteKit Router: https://github.com/sveltejs/kit
 * - Vue Router: https://github.com/vuejs/router
 */

import {
  findRoute,
  matchAllRoutes,
  matchRoute,
  normalizeURL,
} from 'shared/routing';
import { isFunction, isString } from 'shared/utils/unit';
import { isLinkExternal } from 'shared/utils/url';

import { removeSSRStyles } from '../utils';
import {
  createSimpleComparator,
  type RoutesComparator,
  type RoutesComparatorFactory,
} from './comparators';
import { listen } from './listen';
import { loadRoutes } from './load-route';
import type { Reactive } from './reactivity';
import {
  createSimpleScrollDelegate,
  type ScrollDelegate,
  type ScrollDelegateFactory,
} from './scroll-delegate';
import type {
  AfterNavigateHook,
  BeforeNavigateHook,
  ClientLoadableRoute,
  ClientLoadedRoute,
  ClientMatchedRoute,
  ClientRouteDeclaration,
  Navigation,
  NavigationOptions,
  NavigationRedirector,
  RouterGoOptions,
} from './types';

export type RouterOptions = {
  baseUrl: string;
  trailingSlash?: boolean;
  frameworkDelegate: RouterFrameworkDelegate;
};

export type RouterFrameworkDelegate = {
  tick: () => void | Promise<void>;
  route: Reactive<ClientLoadedRoute>;
  matches: Reactive<ClientLoadedRoute[]>;
  navigation: Reactive<Navigation>;
};

let navigationToken = {};

export class Router {
  protected _url: URL;
  protected _listening = false;
  protected _scroll: ScrollDelegate;
  protected _comparator: RoutesComparator;
  protected _fw: RouterFrameworkDelegate;
  protected _routes: ClientLoadableRoute[] = [];
  protected _redirectsMap = new Map<string, string>();
  protected _beforeNavigate: BeforeNavigateHook[] = [];
  protected _afterNavigate: AfterNavigateHook[] = [];

  /** Key used to save navigation state in history state object. */
  historyKey = 'vbk::index';
  /** Keeps track of the history index in order to prevent popstate navigation events. */
  historyIndex!: number;

  /**
   * The current URL.
   */
  get url() {
    return this._url;
  }
  /**
   * Whether the router is disabled. Disabling the router means the browser will handle all
   * navigation and calling `goto` will be a no-op.
   *
   * @defaultValue `false`
   */
  disabled = false;
  /**
   * The base URL for all routes.
   *
   * @defaultValue `'/'`
   */
  readonly baseUrl: string;
  /**
   * Whether a slash should be appended to the end of HTML routes. This is modified by adapters
   * accordingly by injecting `__VSL_TRAILING_SLASH__` into the `window` object.
   *
   * @defaultValue `true`
   */
  readonly trailingSlash: boolean;
  /**
   * Whether the router has loaded the first route and started listening for link clicks to handle
   * SPA navigation.
   */
  get listening() {
    return this._listening;
  }
  /**
   * The currently loaded route.
   */
  get currentRoute() {
    return this._fw.route.get();
  }
  /**
   * Delegate used to handle scroll-related tasks. The default delegate simply saves scroll
   * positions for pages during certain navigation events.
   */
  get scrollDelegate() {
    return this._scroll;
  }

  constructor(options: RouterOptions) {
    this._url = new URL(location.href);
    this.baseUrl = options.baseUrl;
    this.trailingSlash = !!options.trailingSlash;
    this._comparator = createSimpleComparator();
    this._scroll = createSimpleScrollDelegate(this);
    this._fw = options.frameworkDelegate;

    // make it possible to reset focus
    document.body.setAttribute('tabindex', '-1');

    // Keeping track of the this._history index in order to prevent popstate navigation events if needed.
    this.historyIndex = history.state?.[this.historyKey];

    if (!this.historyIndex) {
      // We use Date.now() as an offset so that cross-document navigations within the app don't
      // result in data loss.
      this.historyIndex = Date.now();

      // create initial this._history entry, so we can return here
      history.replaceState(
        {
          ...history.state,
          [this.historyKey]: this.historyIndex,
        },
        '',
        location.href,
      );
    }
  }

  /**
   * Builds and returns a normalized application URL.
   */
  createURL(pathnameOrURL: string | URL): URL {
    const url = !isString(pathnameOrURL)
      ? new URL(pathnameOrURL)
      : new URL(
          pathnameOrURL,
          isLinkExternal(pathnameOrURL, this.baseUrl)
            ? undefined
            : pathnameOrURL.startsWith('#')
            ? /(.*?)(#|$)/.exec(location.href)![1]
            : getBaseUri(this.baseUrl),
        );

    return this.normalizeURL(url);
  }

  /**
   * Checks whether the given URL belongs to this application.
   */
  owns(url: URL): boolean {
    return (
      url.origin === location.origin && url.pathname.startsWith(this.baseUrl)
    );
  }

  /**
   * Returns whether the given pathname matches any page route.
   */
  test(pathnameOrURL: string | URL): boolean {
    const url = this.createURL(pathnameOrURL);
    return !!findRoute(url, this._routes);
  }

  /**
   * Attempts to find a matching route for the given a pathname or URL.
   */
  match(pathnameOrURL: string | URL): ClientMatchedRoute | null {
    const url = this.createURL(pathnameOrURL);
    return this.owns(url) ? matchRoute(url, this._routes) : null;
  }

  /**
   * Attempts to find all matching routes for the given pathname or URL.
   */
  matchAll(pathnameOrURL: string | URL): ClientMatchedRoute[] {
    const url = this.createURL(pathnameOrURL);
    return this.owns(url) ? matchAllRoutes(url, this._routes) : [];
  }

  /**
   * Registers a new route given a declaration.
   */
  add(declaration: ClientRouteDeclaration): ClientLoadableRoute {
    const exists = declaration.id && this.findById(declaration.id);
    if (exists) return exists;

    const route: ClientLoadableRoute = {
      ...declaration,
      pattern: new URLPattern({ pathname: declaration.pathname }),
      score: declaration.score ?? this._comparator.score(declaration),
    };

    this._routes.push(route);
    this._routes = this._comparator.sort(this._routes);

    return route;
  }

  /**
   * Quickly adds a batch of predefined routes.
   */
  addAll(routes: ClientLoadableRoute[]) {
    this._routes.push(...routes);
    this._routes = this._comparator.sort(this._routes);
  }

  /**
   * Deregisters a route given it's id.
   */
  remove(id: string | symbol): void {
    this._routes = this._routes.filter((r) => r.id !== id);
  }

  /**
   * Attempts to find and return a registered route given a route id.
   */
  findById(id: string | symbol) {
    return this._routes.find((route) => route.id === id);
  }

  /**
   * Navigate to the previous page.
   */
  back(): void {
    return history.back();
  }

  /**
   * Attempts to match the given path to a declared route and navigate to it. The path can be a
   * URL pathname (e.g., `/a/path.html`), hash (e.g., `#some-id`), or URL instance
   * (e.g., `new URL(...)`).
   */
  async go(
    path: string | URL,
    {
      scroll,
      replace = false,
      keepfocus = false,
      state = {},
    }: RouterGoOptions = {},
  ): Promise<void> {
    if (isString(path) && path.startsWith('#')) {
      const hash = path;
      this.hashChanged(hash);
      this._changeHistoryState(this._url, state, replace);
      await this._scroll.scroll?.({ target: scroll, hash });
      this._scroll.savePosition?.();
      return;
    }

    const url = this.createURL(path);

    if (!this.disabled) {
      return this.navigate(url, {
        scroll,
        keepfocus,
        replace,
        state,
      });
    }

    await this.goLocation(url);
  }

  /**
   * Loads `href` the old-fashioned way, with a full page reload. Returns a `Promise` that never
   * resolves to prevent any subsequent work (e.g., this._history manipulation).
   */
  goLocation(url: URL): Promise<void> {
    location.href = url.href;
    return new Promise(() => {
      /** no-op */
    });
  }

  /**
   * Add a redirect from a given pathname to another.
   */
  addRedirect(from: string | URL, to: string | URL): void {
    this._redirectsMap.set(this.createURL(from).href, this.createURL(to).href);
  }

  /**
   * Attempts to find a route given a pathname or URL and call it's prefetch handler. This method
   * will throw if no route matches the given pathname.
   */
  async prefetch(pathnameOrURL: string | URL): Promise<void> {
    const url = this.createURL(pathnameOrURL);

    const redirecting = this._redirectCheck(url, (to) => this.prefetch(to));
    if (redirecting) return redirecting;

    const matches = this.matchAll(url);

    if (matches.length === 0) {
      if (import.meta.env.DEV) {
        console.warn(
          `[vessel] attempted to prefetch a URL that does not belong to this app: \`${url.href}\``,
        );
      }
      return;
    }

    await loadRoutes(url, matches);
  }

  /**
   * Normalize trailing slashes.
   */
  normalizeURL(url: URL) {
    return normalizeURL(url, this.trailingSlash);
  }

  /**
   * Start the router and begin listening for link clicks we can intercept them and handle SPA
   * navigation. This has no effect after initial call.
   */
  async start(
    mount: (target: HTMLElement) => void | Promise<void>,
  ): Promise<void> {
    if (!this._listening) {
      await this.go(location.href, { replace: true });
      const target = document.getElementById('app')!;
      await mount(target);
      removeSSRStyles();
      listen(this);
      this._listening = true;
    }
  }

  /**
   * Called when navigating to a new route and right before a new page is loaded. Returning a
   * redirect path will navigate to the matching route declaration.
   *
   * @defaultValue undefined
   */
  beforeNavigate(hook: BeforeNavigateHook): void {
    this._beforeNavigate.push(hook);
  }

  /**
   * Called after navigating to a new route and it's respective page has loaded.
   *
   * @defaultValue undefined
   */
  afterNavigate(hook: AfterNavigateHook): void {
    this._afterNavigate.push(hook);
  }

  /**
   * Set a new delegate for handling scroll-related tasks.
   */
  setScrollDelegate<T extends ScrollDelegate>(
    manager: T | ScrollDelegateFactory<T>,
  ): T {
    return (this._scroll = isFunction(manager) ? manager?.(this) : manager);
  }

  /**
   * Adds a new route comparator to handle matching, scoring, and sorting routes.
   */
  setRouteComparator(factory: RoutesComparatorFactory): void {
    this._comparator = factory() ?? createSimpleComparator();
  }

  /**
   * Notifies the router of a hash change.
   */
  hashChanged(hash: string) {
    this._url.hash = hash;
    const route = this.currentRoute;
    if (route) {
      this._fw.route.set({
        ...route,
        url: this._url,
      });
    }
  }

  /** @internal */
  async navigate(
    url: URL,
    {
      scroll,
      accepted,
      blocked,
      state = {},
      keepfocus = false,
      replace = false,
      redirects = [],
    }: NavigationOptions,
  ) {
    const token = (navigationToken = {});

    let cancelled = false;
    const cancel = () => {
      this._fw.navigation.set(null);
      if (!cancelled) {
        if (import.meta.env.DEV) {
          console.log(`[vessel] cancelled navigation to \`${url.pathname}\``);
        }
        blocked?.();
      }
      cancelled = true;
    };

    // TODO: check for redirect loop here?? -> load first matching error page?

    const handleRedirect = (to: URL) => {
      if (import.meta.env.DEV) {
        console.info(
          `[vessel] redirecting from \`${url.href}\` to \`${to.href}\``,
        );
      }

      redirects.push(to.pathname);
      return this.navigate(to, {
        keepfocus,
        replace,
        state,
        accepted,
        blocked: cancel,
        redirects,
      });
    };

    let redirecting = this._redirectCheck(url, handleRedirect);
    if (redirecting) return redirecting;

    if (!this.owns(url)) {
      cancel();
      if (import.meta.env.DEV) {
        console.warn(
          `[vessel] attempted to navigate to a URL that does not belong to this app: \`${url.href}\``,
        );
      }
      return;
    }

    // Abort if user navigated again during micotick.
    await Promise.resolve();
    if (token !== navigationToken) return;

    const match = this.match(url);

    if (!match?.page) {
      cancel();

      // TODO: find closest error boundary (404) -> if none fallback to server

      // Happens in SPA fallback mode - don't go back to the server to prevent infinite reload.
      if (
        url.origin === location.origin &&
        url.pathname === location.pathname
      ) {
        // TODO: this should be 404 -> root error page?
      }

      // Let the server decide what to do.
      // await this.goLocation(url);
      return;
    }

    const redirect = this._createRedirector(url, (redirectURL) => {
      redirecting = handleRedirect(redirectURL);
    });

    const from = this.currentRoute;

    for (const hook of this._beforeNavigate) {
      await hook({ from, to: match, cancel, redirect });
    }

    if (cancelled) return;
    if (redirecting) return redirecting;

    this.scrollDelegate.savePosition?.();
    this._fw.navigation.set({ from: from?.url, to: url });
    accepted?.();

    if (import.meta.env.DEV && from) {
      console.log(
        `[vessel] navigating from \`${from.url.pathname}\` to \`${url.pathname}\``,
      );
    }

    const matches = this.matchAll(url);
    const loadResults = await loadRoutes(url, matches);

    // TODO: this can return a possible redirect (prob need LoadRouteResult)
    // TODO: this can return a bad result 400? - should it return error?
    // process results -> look for static redirects first, then server redirects
    // look for any unexpected errors (not HTTP) for both static/server
    // if any error -> handle from specific route
    // group everything

    // TODO: FIX TYPES
    const to = null as any;
    const loadedMatches = null as any;

    this._fw.matches.set(loadedMatches);
    this._fw.route.set(to);

    // Wait a tick so page is rendered before updating history.
    await this._fw.tick();

    this._changeHistoryState(to.url, state, replace);
    if (!keepfocus) resetFocus();

    await this.scrollDelegate.scroll?.({
      from,
      to,
      target: scroll,
      hash: to.url.hash,
    });

    this._url = url;
    this._fw.navigation.set(null);

    for (const hook of this._afterNavigate) {
      await hook({ from, to });
    }
  }

  protected _createRedirector(
    from: URL,
    handle: (url: URL) => void | Promise<void>,
  ): NavigationRedirector {
    const fromURL = this.createURL(from);
    return async (pathnameOrURL) => {
      const redirectURL = this.createURL(pathnameOrURL);
      this.addRedirect(fromURL, redirectURL);
      await handle(redirectURL);
    };
  }

  protected _redirectCheck(
    url: URL,
    handle: (to: URL) => void | null | Promise<void>,
  ): void | null | Promise<void> {
    const href = this.normalizeURL(url).href;

    if (!this._redirectsMap.has(href)) return;

    const redirectHref = this._redirectsMap.get(href)!;
    const redirectURL = new URL(redirectHref);

    return this.owns(url) ? handle(redirectURL) : this.goLocation(url);
  }

  protected _changeHistoryState = (url: URL, state: any, replace: boolean) => {
    const change = replace ? 0 : 1;
    state[this.historyKey] = this.historyIndex += change;
    history[replace ? 'replaceState' : 'pushState'](state, '', url);
  };
}

function getBaseUri(baseUrl = '/') {
  return `${location.protocol}//${location.host}${
    baseUrl === '/' ? '' : baseUrl
  }`;
}

// Taken from SvelteKit
function resetFocus() {
  // Reset page selection and focus.
  // We try to mimic browsers' behaviur as closely as possible by targeting the
  // first scrollable region, but unfortunately it's not a perfect match — e.g.
  // shift-tabbing won't immediately cycle up from the end of the page on Chromium
  // See https://html.spec.whatwg.org/multipage/interaction.html#get-the-focusable-area
  const root = document.body;
  const tabindex = root.getAttribute('tabindex');
  getSelection()?.removeAllRanges();
  root.tabIndex = -1;
  root.focus({ preventScroll: true });
  // restore `tabindex` as to prevent `root` from stealing input from elements
  if (tabindex !== null) {
    root.setAttribute('tabindex', tabindex);
  } else {
    root.removeAttribute('tabindex');
  }
}
