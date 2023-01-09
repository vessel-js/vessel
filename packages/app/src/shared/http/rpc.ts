import type { ServerRequestHandler } from 'server/types';

import type { RequestParams } from './request';
import type { AnyResponse, VesselResponse } from './response';

export interface RPCHandler {
  (...args: any[]): AnyResponse;
  rpc?: RPCFetchInfo;
}

export type RPCFetchInfo = [method: string, path: string];

export type InferRPCParams<RPC extends RPCHandler> = RPC extends ServerRequestHandler<infer Params>
  ? Params
  : RequestParams;

export type InferRPCResponse<RPC extends RPCHandler> = RPC extends ServerRequestHandler<
  never,
  infer Data
>
  ? Promise<Data extends Response ? Data : VesselResponse>
  : Promise<VesselResponse>;
