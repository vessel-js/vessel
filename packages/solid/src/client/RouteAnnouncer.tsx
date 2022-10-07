import { createEffect, createSignal, onMount } from 'solid-js';

import { useRoute } from './context';

function RouteAnnouncer() {
  const [title, setTitle] = createSignal<string>();
  const [mounted, setMounted] = createSignal(false);
  const [navigated, setNavigated] = createSignal(false);
  const route = useRoute();

  onMount(() => {
    setMounted(true);
  });

  createEffect(() => {
    if (mounted() && route()) {
      setNavigated(true);
      setTitle(document.title || 'untitled page');
    }
  });

  return () =>
    mounted() ? (
      <div
        id="route-announcer"
        aria-live="assertive"
        aria-atomic="true"
        style="position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px"
      >
        {navigated() ? title() : null}
      </div>
    ) : null;
}

export default RouteAnnouncer;
