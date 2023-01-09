import { isNumber } from 'shared/utils/unit';

export type HttpErrorData = Record<string, any>;

export class HttpError<ErrorData extends HttpErrorData = HttpErrorData> extends Error {
  readonly name = 'HttpError' as const;
  readonly status: number;

  constructor(
    message: string,
    public readonly init?: number | ResponseInit,
    public readonly data?: ErrorData,
  ) {
    super(message);
    this.status = isNumber(init) ? init : init?.status ?? 200;
  }
}

export function isHttpError(error: any): error is HttpError {
  // Don't do `instanceof HttpError` because this is bundled separately for client/server - they
  // won't be the same type.
  return error instanceof Error && error.name === 'HttpError';
}

export function isErrorResponse(response: Response) {
  return response.headers.has('X-Vessel-Error');
}

export function isExpectedErrorResponse(response: Response) {
  return response.headers.has('X-Vessel-Expected');
}

export async function tryResolveResponseError(response: Response): Promise<HttpError | null> {
  if (isErrorResponse(response)) {
    const data = await response.json();

    if (isExpectedErrorResponse(response)) {
      return new HttpError(data.error.message, response.status, data.error.data);
    }

    const error = Error(data.error.message);
    error.stack = data.error.stack;
    throw error;
  }

  return null;
}

export function invariant(value: boolean, message?: string): asserts value;

export function invariant<T>(value: T | null | undefined, message?: string): asserts value is T;

/**
 * Throws HTTP bad request (status code 400) if the value is `false`, `null`, or `undefined`.
 */
export function invariant(
  value: unknown,
  message = 'invalid falsy value',
  data?: Record<string, unknown>,
) {
  if (value === false || value === null || typeof value === 'undefined') {
    throw httpError(message, 400, data);
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
  if (!condition) throw httpError(message, 422, data);
}

/**
 * Functional helper to create a `HttpError` class.
 */
export function httpError(...params: ConstructorParameters<typeof HttpError>) {
  return new HttpError(...params);
}
