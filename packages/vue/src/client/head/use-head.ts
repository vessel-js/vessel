/**
 * Credit: https://github.com/vueuse/head
 */

import type { HeadConfig, HeadManager } from '@vessel-js/app/head';
import { HEAD_MANAGER } from 'client/context-keys';
import { inject, onBeforeUnmount, watchEffect } from 'vue';

export function useHeadManager(): HeadManager {
  return inject(HEAD_MANAGER)!;
}

export const useHead = (config: HeadConfig) => {
  const manager = useHeadManager();
  manager.add(config);

  if (!import.meta.env.SSR) {
    watchEffect(() => {
      manager.update();
    });

    onBeforeUnmount(() => {
      manager.remove(config);
      manager.update();
    });
  }
};
