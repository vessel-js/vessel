import { isString, isUndefined } from 'shared/utils/unit';

import type { Router } from './client-router';
import type { ClientLoadedRoute } from './types';

const SCROLL_KEY = 'vessel:scroll';

/**
 * The simple scroll delegate saves the scroll position of each page to ensure it's put back
 * when the user either navigates back, reloads, or re-opens the tab.
 */
export const createSimpleScrollDelegate: ScrollDelegateFactory = (router) => {
  let scrollPositions: Record<string, ScrollPosition> = {};

  if (!import.meta.env.SSR) {
    try {
      scrollPositions = JSON.parse(sessionStorage[SCROLL_KEY]);
    } catch {
      // no-op
    }

    // Recover scroll position if we reload the page, or Cmd-Shift-T back to it.
    const scroll = scrollPositions[router.historyIndex];
    if (scroll) {
      history.scrollRestoration = 'manual';
      window.scrollTo(scroll.left, scroll.top);
    }
  }

  return {
    savePosition() {
      if (import.meta.env.SSR) return;
      scrollPositions[router.historyIndex] = scrollPosition();
    },
    getSavedPosition(state) {
      return scrollPositions[state[SCROLL_KEY]];
    },
    commit() {
      if (import.meta.env.SSR) return;
      try {
        sessionStorage[SCROLL_KEY] = JSON.stringify(scrollPositions);
      } catch {
        // no-op
      }
    },
  };
};

/**
 * The complex scroll delegate saves the scroll position of each page to ensure it's put back
 * when the user either navigates back, reloads, or re-opens the tab. In addition, it enables
 * you to perform complex scrolling logic during navigation whilst adjusting base position and
 * behavior.
 */
export const createComplexScrollDelegate: ScrollDelegateFactory<ComplexScrollDelegate> = (
  router,
) => {
  let scrollPositions: Record<string, ScrollPosition> = {},
    _base: () => ScrollBase | undefined,
    _behavior: ScrollBehaviorHook | undefined;

  if (!import.meta.env.SSR) {
    try {
      scrollPositions = JSON.parse(sessionStorage[SCROLL_KEY]);
    } catch {
      // no-op
    }

    // Recover scroll position if we reload the page, or Cmd-Shift-T back to it.
    const scroll = scrollPositions[router.historyIndex];
    if (scroll) {
      history.scrollRestoration = 'manual';
      window.scrollTo(scroll.left, scroll.top);
    }
  }

  async function scroll({ target, hash, from, to }: ScrollOptions) {
    if (import.meta.env.SSR) return;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };

    let scrollTarget: ScrollTarget = null;
    if (target) {
      scrollTarget = await target({ cancel });
    } else if (!isUndefined(from) && to && _behavior) {
      scrollTarget = await _behavior({
        from,
        to,
        cancel,
        savedPosition: scrollPositions[router.historyIndex],
      });
    }

    if (scrollTarget === false) {
      cancel();
      return;
    }

    if (cancelled) return;

    const deepLinked = hash ? document.getElementById(decodeURI(hash).slice(1)) : null;

    const scrollTo = (options: ScrollToOptions) => {
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo(options);
      } else {
        window.scrollTo(options.left ?? 0, options.top ?? 0);
      }
    };

    const base = _base?.();
    const baseTop = base?.top ?? 0;
    const baseLeft = base?.left ?? 0;

    if (scrollTarget) {
      const el = isString(scrollTarget.el)
        ? document.querySelector(scrollTarget.el)
        : scrollTarget.el;

      const docRect = document.documentElement.getBoundingClientRect();
      const elRect = el?.getBoundingClientRect() ?? { top: 0, left: 0 };
      const offsetTop = baseTop + (scrollTarget.top ?? 0);
      const offsetLeft = baseLeft + (scrollTarget.left ?? 0);
      const baseBehavior = base?.behavior ?? 'auto';
      const behavior = scrollTarget.behavior ?? baseBehavior;

      scrollTo({
        left: elRect.left - docRect.left - offsetLeft,
        top: elRect.top - docRect.top - offsetTop,
        behavior,
      });
    } else if (deepLinked) {
      deepLinked.scrollIntoView();
    } else {
      scrollTo({ top: baseTop, left: baseLeft });
    }
  }

  const manager: ComplexScrollDelegate = {
    scroll,
    setBase(base) {
      _base = base;
    },
    setBehavior(behavior) {
      _behavior = behavior;
    },
    savePosition() {
      if (import.meta.env.SSR) return;
      scrollPositions[router.historyIndex] = scrollPosition();
    },
    getSavedPosition(state) {
      return scrollPositions[state[SCROLL_KEY]];
    },
    commit() {
      if (import.meta.env.SSR) return;
      try {
        sessionStorage[SCROLL_KEY] = JSON.stringify(scrollPositions);
      } catch {
        // no-op
      }
    },
  };

  return manager;
};

export interface ScrollDelegate {
  /**
   * Scrolls to the given target element, hash, or position.
   */
  scroll?(options: ScrollOptions): void;
  /**
   * Called by the router at certain points such as before navigating to a new page or the
   * URL hash changing.
   */
  savePosition?(): void;
  /**
   * Expected to return the saved scroll position given the history state object.
   */
  getSavedPosition?(state: Record<string, any>): ScrollPosition;
  /**
   * Called when scroll positions should be persisted (i.e., local/session storage).
   */
  commit?(): void;
}

export interface ComplexScrollDelegate extends Required<ScrollDelegate> {
  /**
   * Base scroll settings that are applied to all scrolls.
   */
  setBase(calc: () => ScrollBase): void;
  /**
   * Indicates how the browser should scroll when navigating to a new page.
   *
   * @defaultValue `'auto'`
   */
  setBehavior(hook: ScrollBehaviorHook): void;
}

export interface ScrollDelegateFactory<T extends ScrollDelegate = ScrollDelegate> {
  (router: Router): T;
}

export interface ScrollBase extends ScrollToOptions {}

export interface ScrollOptions {
  hash?: string;
  from?: ClientLoadedRoute | null;
  to?: ClientLoadedRoute;
  target?: ScrollToTarget | null;
}

export interface ScrollBehaviorHook {
  (info: {
    from: ClientLoadedRoute | null;
    to: ClientLoadedRoute;
    cancel: ScrollCancel;
    savedPosition?: { top?: number; left?: number };
  }): ScrollTarget | Promise<ScrollTarget>;
}

export interface ScrollPosition {
  top: number;
  left: number;
}

export function scrollPosition(): ScrollPosition {
  return {
    top: scrollY,
    left: scrollX,
  };
}

export type ScrollTarget = void | null | false | (ScrollToOptions & { el?: string | HTMLElement });

export interface ScrollToTarget {
  (info: { cancel: ScrollCancel }): ScrollTarget;
}

export interface ScrollCancel {
  (): void;
}
