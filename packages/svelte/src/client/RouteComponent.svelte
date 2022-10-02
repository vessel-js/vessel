<script>
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  import {
    SERVER_DATA_KEY,
    SERVER_ERROR_KEY,
    STATIC_DATA_KEY,
  } from './context';

  export let component;
  export let leaf = false;

  const staticData = writable({}),
    serverData = writable(),
    serverError = writable();

  setContext(STATIC_DATA_KEY, staticData);
  setContext(SERVER_DATA_KEY, serverData);
  setContext(SERVER_ERROR_KEY, serverError);

  $: staticData.set(component?.staticData ?? {});
  $: serverData.set(component?.serverData);
  $: serverError.set(component?.serverLoadError);
</script>

{#if component}
  {#if !leaf}
    <svelte:component this={component.module.default}>
      <slot />
    </svelte:component>
  {:else}
    <svelte:component this={component.module.default} />
  {/if}
{:else if !leaf}
  <slot />
{/if}
