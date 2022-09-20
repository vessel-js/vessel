import type { LoadedServerData } from 'shared/routing/types';

export async function resolveServerResponseData(
  response: Response,
): Promise<LoadedServerData> {
  const contentType = response.headers.get('Content-Type');
  return contentType && /\bapplication\/json\b/.test(contentType)
    ? response.json()
    : response.text();
}
