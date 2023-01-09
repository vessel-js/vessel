import type { ServerMiddlewareEntry } from 'server/types';
import { type FetchMiddleware } from 'shared/http';
import { isString } from 'shared/utils/unit';

export function resolveMiddleware(
  globals: ServerMiddlewareEntry[] = [],
  provided: (string | FetchMiddleware)[] = [],
  defaultGroup?: 'page' | 'api',
) {
  const nonGroupedMiddleware = globals
    .filter((entry) => !entry.group)
    .map((entry) => entry.handler);

  const seen = new Set<string | FetchMiddleware>(nonGroupedMiddleware);
  const middlewares: FetchMiddleware[] = [...nonGroupedMiddleware];

  const withDefaultGroup = defaultGroup ? [defaultGroup, ...provided] : provided;

  for (const middleware of withDefaultGroup) {
    if (seen.has(middleware)) continue;

    if (isString(middleware)) {
      const group = globals
        .filter((entry) => entry.group === middleware)
        .map((entry) => entry.handler);

      middlewares.push(...group);
    } else {
      middlewares.push(middleware);
    }

    seen.add(middleware);
  }

  return middlewares;
}
