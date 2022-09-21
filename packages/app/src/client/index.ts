export * from './init';
export * from './router';
export * from './utils';
export * from 'shared/http/errors';
export * from 'shared/markdown';
export {
  type LoadedServerData,
  type LoadedStaticData,
} from 'shared/routing/types';

export type AppConfig = {
  id: string;
  baseUrl: string;
  module: { [id: string]: unknown };
};
