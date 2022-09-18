import type { App } from 'node/app/App';
import type { RouteFile } from 'node/app/files';
import { handleHTTPRequest } from 'node/http';
import { setResponse } from 'node/http/http-bridge';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createHttpHandler,
  error,
  handleHttpError,
  type HttpRequestModule,
} from 'server/http';
import { findRoute } from 'shared/routing';
import { coalesceToError } from 'shared/utils/error';

import { handleDevServerError, logDevError } from './dev-server';

type HandleHttpRequestInit = {
  app: App;
  base: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  loader: (file: RouteFile) => Promise<HttpRequestModule>;
  dev?: boolean;
};

export async function handleHttpRequest({
  app,
  base,
  url,
  req,
  res,
  loader,
  dev,
}: HandleHttpRequestInit) {
  const route = findRoute(url, app.routes.filterByType('http'));

  if (!route) {
    await setResponse(res, handleHttpError(error('not found', 400)));
    return;
  }

  const handler = createHttpHandler({
    dev,
    pattern: route.pattern,
    loader: () => loader(route.http!),
    getClientAddress: () => req.socket.remoteAddress,
    onError: (error) => {
      logDevError(app, req, coalesceToError(error));
    },
  });

  try {
    await handleHTTPRequest(base, req, res, handler, (error) => {
      logDevError(app, req, coalesceToError(error));
    });
  } catch (error) {
    handleDevServerError(app, req, res, error);
  }
}
