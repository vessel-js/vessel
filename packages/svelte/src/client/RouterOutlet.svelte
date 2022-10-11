<script>
  import { useRouteMatches } from './context';
  import RouteSegment from './RouteSegment.svelte';

  const matches = useRouteMatches();
</script>

<RouteSegment matches={$matches} depth={0} />
