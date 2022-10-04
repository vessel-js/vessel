import kleur from 'kleur';
import { type ServerManifest } from 'server/types';
import { isHttpError, json } from 'shared/http';
import { coerceToError } from 'shared/utils/error';

export function handleHttpError(
  error: unknown,
  url?: URL,
  manifest?: ServerManifest,
) {
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
    if (!manifest?.dev) {
      response = json({ error: { message: 'internal server error' } }, 500);
    } else {
      if (url) manifest?.hooks?.onUnexpectedHttpError?.(url, error);

      const err = coerceToError(error);

      console.error(
        kleur.bold(kleur.red(`\n🚨 Unexpected HTTP Error`)),
        `\n\n${kleur.bold('Messsage:')} ${err.message}`,
        url ? `\n${kleur.bold('URL:')} ${url?.pathname}${url?.search}` : '',
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
