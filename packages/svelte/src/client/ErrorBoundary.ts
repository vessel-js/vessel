/**
 * Adapted from: https://github.com/CrownFramework/svelte-error-boundary
 */

import { writable } from 'svelte/store';

import RouteErrorBoundary from './RouteErrorBoundary.svelte';

export default createErrorBoundary(RouteErrorBoundary);

// https://github.com/sveltejs/svelte/blob/master/src/runtime/internal/Component.ts#L13
const LIFECYCLE_METHODS = ['c', 'l', 'h', 'm', 'p', 'r', 'f', 'a', 'i', 'o', 'd'];

function createErrorBoundary(Component) {
  if (import.meta.env.SSR) {
    if (Component.$$render) {
      const render = Component.$$render;

      Component.$$render = (result, props, bindings, slots) => {
        const renderError = writable<Error | undefined>(undefined);

        try {
          return render(result, { renderError, ...props }, bindings, slots);
        } catch (e) {
          renderError.set(e as Error);
          return render(result, { renderError, ...props }, bindings, {});
        }
      };

      return Component;
    }
  }

  return class SvelteErrorBoundaryComponent extends Component {
    constructor(config) {
      const renderError = writable(undefined);
      config.props.renderError = renderError;

      const slots = config.props.$$slots;
      const defaultSlot = slots.default[0];
      slots.default[0] = (...args) => {
        const guarded = createTryFn(defaultSlot, renderError.set);
        const block = guarded(...args);

        if (block) {
          for (const fn of LIFECYCLE_METHODS) {
            if (block[fn]) block[fn] = createTryFn(block[fn], renderError.set);
          }
        }

        return block;
      };

      super(config);
    }
  };
}

function createTryFn(fn, onError) {
  return function tryFn(...args) {
    try {
      return fn(...args);
    } catch (error) {
      onError(error);
    }
  };
}
