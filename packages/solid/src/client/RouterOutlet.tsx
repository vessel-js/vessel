import { useRouteMatches } from './context';
import RouteSegment from './RouteSegment';

function RouterOutlet() {
  const matches = useRouteMatches();
  return <RouteSegment matches={matches()} depth={0} />;
}

export default RouterOutlet;
