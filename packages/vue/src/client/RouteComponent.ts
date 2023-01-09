import { type ClientLoadedRoute } from '@vessel-js/app';
import { computed, defineComponent, h, provide } from 'vue';

import { SERVER_DATA_KEY, SERVER_ERROR_KEY, STATIC_DATA_KEY } from './context-keys';

export default defineComponent<{
  component?: ClientLoadedRoute['page'];
  leaf?: boolean;
}>({
  name: 'RouteComponent',
  props: ['component', 'leaf'] as any,
  setup(props, { slots }) {
    const staticData = computed(() => props.component?.staticData ?? {}),
      serverData = computed(() => props.component?.serverData),
      serverError = computed(() => props.component?.serverLoadError);

    provide(STATIC_DATA_KEY, staticData);
    provide(SERVER_DATA_KEY, serverData);
    provide(SERVER_ERROR_KEY, serverError);

    return () =>
      props.component
        ? h(props.component!.module.default, () => (!props.leaf ? slots.default?.() : undefined))
        : !props.leaf && slots.default?.();
  },
});
