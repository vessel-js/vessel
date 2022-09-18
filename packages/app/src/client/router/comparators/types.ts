import type { ClientLoadableRoute, ClientRouteDeclaration } from '../types';

export type RoutesComparator = {
  /**
   * Returns a score for ranking the given route. Routes with a higher score should be matched
   * before routes with a lower score.
   */
  score(route: ClientRouteDeclaration): number;
  /**
   * Sorts the routes list into the order in which they should be matched. Routes at earlier
   * positions should match first.
   */
  sort(routes: ClientLoadableRoute[]): ClientLoadableRoute[];
};

export type RoutesComparatorFactory = () => RoutesComparator;
