import { configureServer } from '@vessel-js/app/server';

export default configureServer(({ app, router }) => {
  router.basePrefix = '/api';
});
