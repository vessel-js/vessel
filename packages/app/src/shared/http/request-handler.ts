import type { VesselRequest } from './request';
import type { AnyResponse } from './response';

export interface RequestHandler {
  (request: Request): Response | Promise<Response>;
}

export interface VesselRequestHandler {
  (request: VesselRequest): AnyResponse | Promise<AnyResponse>;
}
