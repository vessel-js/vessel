import { defineComponent, h } from 'vue';

export default defineComponent({
  name: 'ProdErrorFallback',
  setup() {
    return () => h('div', { style: 'font-weight: bold;' }, 'Loading failed - try reloading page.');
  },
});
