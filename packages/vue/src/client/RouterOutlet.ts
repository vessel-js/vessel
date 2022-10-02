import { defineComponent, h } from 'vue';

import { getRouteMatches } from './context';
import RouteSegment from './RouteSegment';

export default defineComponent({
  name: 'RouterOutlet',
  setup() {
    const matches = getRouteMatches();
    return () => h(RouteSegment, { matches: matches.value, depth: 0 });
  },
});
