// https://github.com/sveltejs/kit/blob/master/packages/kit/src/utils/error.js#L5
export function coerceError(err: any): Error {
  return err instanceof Error ? err : new Error(JSON.stringify(err));
}
