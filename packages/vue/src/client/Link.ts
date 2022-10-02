import { defineComponent, h } from 'vue';

export default defineComponent<{
  /**
   * Specifies the URL of the linked resource.
   */
  href: VesselRoutes[keyof VesselRoutes] | URL;
  /**
   * Whether this route should begin prefetching if the user is about to interact with the link.
   *
   * @defaultValue true
   */
  prefetch?: boolean;
  /**
   * Replace the current history instead of pushing a new URL on to the stack.
   *
   * @defaultValue false
   */
  replace?: boolean;
}>({
  name: 'Link',
  props: ['href', 'prefetch', 'replace'] as any,
  inheritAttrs: true,
  setup(props, { slots }) {
    return () =>
      h(
        'a',
        {
          href: props.href instanceof URL ? props.href.href : props.href,
          'data-prefetch': props.prefetch !== false ? '' : undefined,
          'data-replace': props.replace ? '' : undefined,
        },
        slots.default?.(),
      );
  },
});
