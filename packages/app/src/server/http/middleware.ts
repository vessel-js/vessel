import type { ServerMiddlewareEntry } from 'server/types';
import { type FetchMiddleware } from 'shared/http';
import { isString } from 'shared/utils/unit';

export function resolveMiddleware(
  globalMiddlewares: ServerMiddlewareEntry[] = [],
  handlerMiddlewares: (string | FetchMiddleware)[] = [],
  defaultMiddlewareGroup?: 'document' | 'api',
) {
  const nonGroupedMiddleware = globalMiddlewares
    .filter((entry) => !entry.group)
    .map((entry) => entry.handler);

  const seen = new Set<string | FetchMiddleware>(nonGroupedMiddleware);
  const middlewares: FetchMiddleware[] = [...nonGroupedMiddleware];

  const withDefaultGroup = defaultMiddlewareGroup
    ? [defaultMiddlewareGroup, ...handlerMiddlewares]
    : handlerMiddlewares;

  for (const middleware of withDefaultGroup) {
    if (seen.has(middleware)) continue;

    if (isString(middleware)) {
      const group = globalMiddlewares
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
