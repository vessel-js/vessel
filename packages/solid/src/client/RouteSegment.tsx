import { type ClientLoadedRoute } from '@vessel-js/app';
import { type ParentComponent } from 'solid-js';

import { useVesselContext } from './context';
import { ROUTE_PARAMS_KEY } from './context-keys';
import RouteComponent from './RouteComponent';
import RouteErrorBoundary from './RouteErrorBoundary';

type RouteSegmentProps = {
  matches: ClientLoadedRoute[];
  depth: number;
};

const RouteSegment: ParentComponent<RouteSegmentProps> = (props) => {
  const match = () => props.matches[props.depth];
  const params = () => match().params;

  const context = useVesselContext();
  context.set(ROUTE_PARAMS_KEY, params);

  return (
    <RouteComponent component={match().layout}>
      <RouteErrorBoundary
        error={match().error}
        boundary={match().errorBoundary}
      >
        {props.depth < props.matches.length - 1 ? (
          <RouteSegment matches={props.matches} depth={props.depth + 1} />
        ) : (
          <RouteComponent component={match().page} leaf />
        )}
      </RouteErrorBoundary>
    </RouteComponent>
  );
};

export default RouteSegment;
