import { defineComponent, h } from 'vue';

import RouteAnnouncer from './RouteAnnouncer';
import RouterOutlet from './RouterOutlet';

export default defineComponent({
  name: 'App',
  setup() {
    return () => [h(RouteAnnouncer), h(RouterOutlet)];
  },
});
