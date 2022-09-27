import kleur from 'kleur';
import { ServerManifest } from 'server/types';
import { HttpError, isHttpError } from 'shared/http';
import { coerceToError } from 'shared/utils/error';

import { json } from './response';

export function invariant(value: boolean, message?: string): asserts value;

export function invariant<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T;

/**
 * Throws HTTP bad request (status code 400) if the value is `false`, `null`, or `undefined`.
 */
export function invariant(
  value: unknown,
  message = 'invalid falsy value',
  data?: Record<string, unknown>,
) {
  if (value === false || value === null || typeof value === 'undefined') {
    throw error(message, 400, data);
  }
}

/**
 * Throws HTTP validation error (status code 422) if the condition is false.
 */
export function validate(
  condition: boolean,
  message = 'validation failed',
  data?: Record<string, unknown>,
) {
  if (!condition) throw error(message, 422, data);
}

/**
 * Functional helper to create a `HttpError` class.
 */
export function error(...params: ConstructorParameters<typeof HttpError>) {
  return new HttpError(...params);
}

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
