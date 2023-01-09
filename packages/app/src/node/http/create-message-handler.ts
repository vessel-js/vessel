import { handleIncomingMessage } from 'node/http';
import { installPolyfills } from 'node/polyfills';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'server/http';
import type { ServerManifest } from 'server/types';
import type { RequestHandler } from 'shared/http';

export function createIncomingMessageHandler(manifest: ServerManifest) {
  let installed = false,
    handler: RequestHandler;

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (!installed) {
      await installPolyfills();
      handler = createServer(manifest);
      installed = true;
    }

    await handleIncomingMessage(`https://${req.headers.host}`, req, res, handler);
  };
}
