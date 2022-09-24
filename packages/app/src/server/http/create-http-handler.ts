import { installURLPattern } from 'server/polyfills';
import type { ServerRequestHandler } from 'server/types';

import { error, handleHttpError } from './errors';
import {
  createRequestEvent,
  getAllowedMethods,
  HttpMethod,
  type HttpRequestModule,
} from './request';
import { isResponse } from './response';

export type HttpHandlerInit = {
  dev?: boolean;
  pathname: string;
  methods?: HttpMethod[];
  loader: () => HttpRequestModule | Promise<HttpRequestModule>;
  onError?: (error: unknown) => Response | void;
};

export function createHttpHandler(init: HttpHandlerInit): ServerRequestHandler {
  installURLPattern();

  const { dev, pathname, methods, loader, onError } = init;
  const pattern = new URLPattern({ pathname });

  return async (request) => {
    try {
      const methodOverride =
        request.method === 'POST'
          ? (await request.formData()).get('_method')
          : null;

      const method = (
        typeof methodOverride === 'string' ? methodOverride : request.method
      ) as HttpMethod;

      if (methods && !methods.includes(method)) {
        throw error('not found', 404);
      }

      const url = new URL(request.url);

      if (!pattern.test({ pathname: url.pathname })) {
        throw error('not found', 404);
      }

      const mod = await loader();

      let handler = mod[method];
      if (!handler && method === 'HEAD') handler = mod.GET;
      if (!handler) handler = mod.ANY;

      if (!handler) {
        throw error(`${method} method not allowed`, {
          status: 405,
          headers: {
            // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
            // "The server must generate an Allow header field in a 405 status code response"
            allow: getAllowedMethods(mod).join(', '),
          },
        });
      }

      const params =
        pattern.exec({ pathname: url.pathname })?.pathname.groups ?? {};

      const event = createRequestEvent({
        request,
        url,
        params,
      });

      const response = await handler(event);

      if (!isResponse(response)) {
        throw new Error(
          `[vessel] invalid return value from route handler at ${url.pathname}, should return a \`Response\`.`,
        );
      }

      for (const [key, value] of event.headers) {
        response.headers.append(key, value);
      }

      event.cookies.serialize(response.headers);

      return response;
    } catch (error) {
      if (isResponse(error)) {
        return error;
      } else {
        return onError?.(error) ?? handleHttpError(error, dev);
      }
    }
  };
}
