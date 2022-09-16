import { esmRequire } from 'node/utils/module';

export const getAppVersion = (): string => {
  return esmRequire()('@vessel-js/app/package.json').version;
};
