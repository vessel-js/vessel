import { defineComponent, h, onMounted, ref, watchEffect } from 'vue';

export default defineComponent({
  name: 'RouteAnnouncer',
  setup() {
    const title = ref<string>();
    const mounted = ref(false);
    const navigated = ref(false);

    onMounted(() => {
      mounted.value = true;
    });

    watchEffect(() => {
      if (mounted.value) {
        navigated.value = true;
        title.value = document.title || 'untitled page';
      }
    });

    return () =>
      mounted.value
        ? h(
            'div',
            {
              id: 'route-announcer',
              'aria-live': 'assertive',
              'aria-atomic': 'true',
              style:
                'position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px',
            },
            navigated.value ? title.value : undefined,
          )
        : null;
  },
});
