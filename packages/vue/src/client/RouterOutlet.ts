import { defineComponent, h } from 'vue';

import { useRouteMatches } from './context';
import RouteSegment from './RouteSegment';

export default defineComponent({
  name: 'RouterOutlet',
  setup() {
    const matches = useRouteMatches();
    return () => h(RouteSegment, { matches: matches.value, depth: 0 });
  },
});
