<script>
  /**
   * Specifies the URL of the linked resource.
   *
   * @type {VesselRoutes[keyof VesselRoutes]}
   */
  export let href;
  /**
   * Whether this route should begin prefetching if the user is about to interact with the link.
   *
   * @type {boolean}
   * @defaultValue true
   */
  export let prefetch = true;
  /**
   * Replace the current history instead of pushing a new URL on to the stack.
   *
   * @type {boolean}
   * @defaultValue false
   */
  export let replace = false;
</script>

<a
  {href}
  {...$$restProps}
  data-prefetch={prefetch ? '' : null}
  data-replace={replace ? '' : null}
>
  <slot />
</a>
