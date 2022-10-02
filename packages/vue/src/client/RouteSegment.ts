import { type ClientLoadedRoute } from '@vessel-js/app';
import { computed, defineComponent, h, provide } from 'vue';

import { ROUTE_PARAMS_KEY } from './context-keys';
import RouteComponent from './RouteComponent';
import RouteErrorBoundary from './RouteErrorBoundary';

const RouteSegment = defineComponent<{
  matches: ClientLoadedRoute[];
  depth: number;
}>({
  name: 'RouteSegment',
  props: ['matches', 'depth'] as any,
  setup(props) {
    const match = computed(() => props.matches[props.depth]);

    const params = computed(() => match.value.params);
    provide(ROUTE_PARAMS_KEY, params);

    return () =>
      h(
        RouteComponent,
        { component: match.value.layout },
        {
          default: () =>
            h(
              RouteErrorBoundary,
              { error: match.value.error, boundary: match.value.errorBoundary },
              {
                default: () => {
                  return props.depth < props.matches.length - 1
                    ? h(RouteSegment, {
                        matches: props.matches,
                        depth: props.depth + 1,
                      })
                    : h(RouteComponent, {
                        component: match.value.page,
                        leaf: true,
                      });
                },
              },
            ),
        },
      );
  },
});

export default RouteSegment;
