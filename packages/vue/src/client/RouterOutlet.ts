import { defineComponent, h } from 'vue';

import { getRouteMatches } from './context';
import RouteComponent from './RouteComponent';
import RouteErrorBoundary from './RouteErrorBoundary';

export default defineComponent({
  name: 'RouterOutlet',
  setup() {
    const matches = getRouteMatches();

    function renderSegment(depth: number) {
      const match = matches.value[depth];
      return h(
        RouteComponent,
        { component: match.layout },
        {
          default: () =>
            h(
              RouteErrorBoundary,
              { error: match.error, boundary: match.errorBoundary },
              {
                default: () => {
                  return depth < matches.value.length - 1
                    ? renderSegment(depth + 1)
                    : h(RouteComponent, { component: match.page, leaf: true });
                },
              },
            ),
        },
      );
    }

    return () => renderSegment(0);
  },
});
