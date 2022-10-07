import { type ClientLoadedRoute } from '@vessel-js/app';
import {
  computed,
  defineComponent,
  h,
  onErrorCaptured,
  ref,
  watchEffect,
} from 'vue';

import DevErrorFallback from './DevErrorFallback';
import ProdErrorFallback from './ProdErrorFallback';

export default defineComponent<{
  error?: ClientLoadedRoute['error'];
  boundary?: ClientLoadedRoute['errorBoundary'];
}>({
  name: 'RouteErrorBoundary',
  props: ['error', 'boundary'] as any,
  setup(props, { slots }) {
    const loadError = ref(props.error);
    const renderError = ref();

    watchEffect(() => {
      loadError.value = props.error;
    });

    const Fallback = computed(
      () =>
        props.boundary?.module.default ??
        (import.meta.env.DEV ? DevErrorFallback : ProdErrorFallback),
    );

    onErrorCaptured((error) => {
      renderError.value = error;
      return false;
    });

    function reset() {
      // TODO: should we try and reload route?
      // loadError.value = null;
      renderError.value = null;
    }

    const error = computed(() => renderError.value ?? loadError.value);

    return () =>
      error.value
        ? h(Fallback.value, { error: error.value, reset })
        : slots.default?.();
  },
});
