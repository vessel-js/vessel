<script>
  import DevErrorFallback from './DevErrorFallback.svelte';
  import ProdErrorFallback from './ProdErrorFallback.svelte';

  export let error;
  export let boundary;
  export let renderError;

  $: err = $renderError ?? error;

  $: fallback =
    boundary?.module?.default ??
    (import.meta.env.DEV ? DevErrorFallback : ProdErrorFallback);

  function reset() {
    // TODO: should we try and reload route?
    error = null;
    renderError.set(null);
  }
</script>

{#if err}
  <svelte:component this={fallback} error={err} {reset} />
{:else}
  <slot />
{/if}
