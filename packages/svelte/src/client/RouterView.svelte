<script>
  import { getRouteMatchesStore } from './context';
  import Noop from './Noop.svelte';

  const matches = getRouteMatchesStore();

  export let index = 0;

  $: match = $matches[index];
</script>

{#if index < $matches.length - 1}
  <svelte:component this={match.layout?.module.default ?? Noop}>
    <svelte:component this={match.errorBoundary?.module.default ?? Noop}>
      <svelte:self index={index + 1}>
        <slot />
      </svelte:self>
    </svelte:component>
  </svelte:component>
{:else}
  <svelte:component this={match.page?.module.default} />
{/if}
