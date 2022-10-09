import kleur from 'kleur';
import type { ServerErrorRoute, ServerManifest } from 'server/types';
import {
  coerceAnyResponse,
  isHttpError,
  json,
  type VesselRequest,
} from 'shared/http';
import { testRoute } from 'shared/routing';
import { coerceError } from 'shared/utils/error';

export async function handleHttpError(
  error: unknown,
  request: VesselRequest,
  manifest: ServerManifest,
): Promise<Response> {
  let response!: Response;

  if (isHttpError(error)) {
    response = json(
      {
        error: {
          message: error.message,
          data: error.data,
        },
      },
      error.init,
    );

    response.headers.set('X-Vessel-Expected', 'yes');
  } else {
    const handled = await runErrorHandlers(
      request,
      error,
      manifest.errorHandlers?.api ?? [],
    );

    if (handled) return handled;

    if (manifest.production) {
      response = json({ error: { message: 'internal server error' } }, 500);
    } else {
      if (!manifest.production) {
        manifest.dev?.onUnexpectedHttpError?.(request, error);
      }

      const err = coerceError(error);

      console.error(
        kleur.bold(kleur.red(`\n🚨 Unexpected HTTP Error`)),
        `\n\n${kleur.bold('Messsage:')} ${err.message}`,
        `\n${kleur.bold('URL:')} ${request.URL.pathname}${request.URL.search}`,
        err.stack ? `\n\n${err.stack}` : '',
        '\n',
      );

      response = json(
        {
          error: {
            message: err.message ?? 'internal server error',
            stack: err.stack,
          },
        },
        500,
      );
    }
  }

  response.headers.set('X-Vessel-Error', 'yes');
  return response;
}

export async function runErrorHandlers(
  request: VesselRequest,
  error: unknown,
  routes: ServerErrorRoute[],
) {
  for (const route of routes) {
    if (testRoute(request.URL, route)) {
      const response = await route.handler(request, error);
      if (response) return coerceAnyResponse(response);
    }
  }

  return null;
}
