import { type VesselRequest } from './request';
import { type AnyResponse } from './response';

export type RequestHandler = (request: Request) => Response | Promise<Response>;

export type VesselRequestHandler = (
  request: VesselRequest,
) => AnyResponse | Promise<AnyResponse>;
