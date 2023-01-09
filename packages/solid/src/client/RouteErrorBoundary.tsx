import { type ClientLoadedRoute } from '@vessel-js/app';
import {
  createComponent,
  createEffect,
  createMemo,
  createSignal,
  onError,
  type ParentComponent,
} from 'solid-js';

import DevErrorFallback from './DevErrorFallback';
import ProdErrorFallback from './ProdErrorFallback';

export type ErrorBoundaryProps = {
  error: unknown;
  reset(): void;
};

type RouteErrorBoundaryProps = {
  error?: ClientLoadedRoute['error'];
  boundary?: ClientLoadedRoute['errorBoundary'];
};

const RouteErrorBoundary: ParentComponent<RouteErrorBoundaryProps> = (props) => {
  const [loadError, setLoadError] = createSignal(props.error);
  const [renderError, setRenderError] = createSignal();

  createEffect(() => {
    setLoadError(props.error);
  });

  const Fallback = createMemo(
    () =>
      props.boundary?.module.default ??
      (import.meta.env.DEV ? DevErrorFallback : ProdErrorFallback),
  );

  onError((error) => {
    setRenderError(error);
  });

  function reset() {
    // TODO: should we try and reload route?
    // loadError.value = null;
    setRenderError(null);
  }

  const error = () => renderError() ?? loadError();

  return createMemo(() =>
    error()
      ? createComponent(Fallback(), {
          get error() {
            return error();
          },
          reset,
        })
      : props.children,
  );
};

export default RouteErrorBoundary;
