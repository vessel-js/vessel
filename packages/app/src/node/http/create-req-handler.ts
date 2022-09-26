import { handleIncomingMessage } from 'node/http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequestHandler } from 'server/http/handle-request';
import { installPolyfills } from 'server/polyfills';
import type { ServerManifest, ServerRequestHandler } from 'server/types';

export function createIncomingMessageHandler(manifest: ServerManifest) {
  let installed = false,
    handler: ServerRequestHandler;

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (!installed) {
      await installPolyfills();
      handler = createRequestHandler(manifest);
      installed = true;
    }

    await handleIncomingMessage(
      `https://${req.headers.host}`,
      req,
      res,
      handler,
    );
  };
}
