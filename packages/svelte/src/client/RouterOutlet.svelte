<script>
  import { getRouteMatches } from './context';
  import RouteSegment from './RouteSegment.svelte';

  const matches = getRouteMatches();
</script>

<RouteSegment matches={$matches} depth={0} />
