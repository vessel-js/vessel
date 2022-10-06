import type { ServerManifest } from 'server/types';
import { type FetchMiddleware } from 'shared/http';
import { isString } from 'shared/utils/unit';

export function resolveMiddleware(
  manifest: ServerManifest,
  handlerMiddleware: (string | FetchMiddleware)[] = [],
  defaultGroup?: 'document' | 'api',
) {
  const globalMiddleware = manifest.middlewares ?? [];

  const nonGroupedMiddleware = globalMiddleware
    .filter((entry) => !entry.group)
    .map((entry) => entry.handler);

  const seen = new Set<string | FetchMiddleware>(nonGroupedMiddleware);
  const middlewares: FetchMiddleware[] = [...nonGroupedMiddleware];

  const withDefaultGroup = defaultGroup
    ? [defaultGroup, ...handlerMiddleware]
    : handlerMiddleware;

  for (const middleware of withDefaultGroup) {
    if (seen.has(middleware)) continue;

    if (isString(middleware)) {
      const group = globalMiddleware
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
