export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export const HTTP_METHODS: Set<string> = new Set([
  'ANY',
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export const ALL_HTTP_METHODS = Array.from(HTTP_METHODS);

export const HTTP_METHOD_RE = /^(any|get|head|post|put|patch|delete)/i;

export const HTML_DOCUMENT_HTTP_METHOD = new Set<string>([
  'GET',
  'HEAD',
  'POST',
]);

export function resolveHandlerHttpMethod(handlerId: string) {
  if (HTTP_METHODS.has(handlerId)) return handlerId;
  const id = handlerId.split(HTTP_METHOD_RE)[1]?.toUpperCase();
  return HTTP_METHODS.has(id) ? id : null;
}
