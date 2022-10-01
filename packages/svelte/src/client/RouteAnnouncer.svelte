<script>
  /**
   * Taken from SvelteKit which was ~maybe adapted from Next.js.
   */

  import { onMount } from 'svelte';
  import { route } from '.';

  let title = null;
  let mounted = false;
  let navigated = false;

  onMount(() => {
    const unsubscribe = route.subscribe(() => {
      if (mounted) {
        navigated = true;
        title = document.title || 'untitled page';
      }
    });

    mounted = true;
    return unsubscribe;
  });
</script>

{#if mounted}
  <div
    id="route-announcer"
    aria-live="assertive"
    aria-atomic="true"
    style="position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px"
  >
    {#if navigated}
      {title}
    {/if}
  </div>
{/if}
