<script>
  import { getRouteStore } from './context';

  const route = getRouteStore();

  export let index = 0;

  $: segment = $route.segments[index];
</script>

{#if index < $route.segments.length}
  <svelte:component this={segment.module.default}>
    <svelte:self index={index + 1}>
      <slot />
    </svelte:self>
  </svelte:component>
{:else}
  <slot />
{/if}
