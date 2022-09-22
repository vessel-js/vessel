import { isNumber } from 'shared/utils/unit';

export type HttpErrorData = Record<string, any>;

export class HttpError<
  ErrorData extends HttpErrorData = HttpErrorData,
> extends Error {
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
