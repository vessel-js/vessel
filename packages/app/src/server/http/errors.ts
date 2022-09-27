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
  const __error = url
    ? manifest?.hooks?.onUnexpectedHttpError?.(url, error) ?? error
    : error;

  console.error(
    kleur.bold(kleur.red(`\n🚨 Unexpected HTTP Error: ${url}`)),
    '\n\n',
    __error,
    '\n',
  );

  let response!: Response;

  if (isHttpError(__error)) {
    response = json(
      {
        error: {
          message: __error.message,
          data: __error.data,
        },
      },
      __error.init,
    );

    response.headers.set('X-Vessel-Expected', 'yes');
  } else {
    if (!manifest?.dev) {
      response = json({ error: { message: 'internal server error' } }, 500);
    } else {
      const error = coerceToError(__error);
      response = json(
        {
          error: {
            message: error.message ?? 'internal server error',
            stack: error.stack,
          },
        },
        500,
      );
    }
  }

  response.headers.set('X-Vessel-Error', 'yes');
  return response;
}
