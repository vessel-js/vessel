/**
 * Credit: https://github.com/vueuse/head
 */

import { type HeadConfig, type HeadManager } from '@vessel-js/app/head';
import { createEffect, onCleanup } from 'solid-js';

import { useVesselContext } from '../context';
import { HEAD_MANAGER } from '../context-keys';

export function useHeadManager() {
  return useVesselContext().get(HEAD_MANAGER) as HeadManager;
}

export const useHead = (config: HeadConfig) => {
  const manager = useHeadManager();
  manager.add(config);

  if (!import.meta.env.SSR) {
    createEffect(() => {
      manager.update();
    });

    onCleanup(() => {
      manager.remove(config);
      manager.update();
    });
  }
};
