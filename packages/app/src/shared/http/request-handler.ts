import { type VesselRequest } from './request';
import { type VesselResponse } from './response';

export type RequestHandler = (request: Request) => Response | Promise<Response>;

export type VesselRequestHandler = (
  request: VesselRequest,
) => Promise<VesselResponse>;
