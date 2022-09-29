import { defineComponent, h } from 'vue';

import RouterOutlet from './RouterOutlet';

export default defineComponent({
  name: 'App',
  setup() {
    return () => h(RouterOutlet);
  },
});
