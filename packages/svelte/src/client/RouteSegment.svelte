<script>
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  import { ROUTE_PARAMS_KEY } from './context-keys';
  import RouteComponent from './RouteComponent.svelte';
  import RouteErrorBoundary from './ErrorBoundary';

  export let matches;
  export let depth;

  $: match = matches[depth];

  const routeParams = writable();
  setContext(ROUTE_PARAMS_KEY, routeParams);
  $: routeParams.set(match.params);
</script>

<RouteComponent component={match.layout}>
  <RouteErrorBoundary error={match.error} boundary={match.errorBoundary}>
    {#if depth < matches.length - 1}
      <svelte:self {matches} depth={depth + 1} />
    {:else}
      <RouteComponent component={match.page} leaf />
    {/if}
  </RouteErrorBoundary>
</RouteComponent>
