import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Accelerator } from '../types/accelerator';
import { MOCK_ACCELERATORS } from '../data/acceleratorCatalog';

interface AcceleratorState {
  accelerators: Accelerator[];
  addAccelerator: (a: Accelerator) => void;
  getBySlug: (slug: string) => Accelerator | undefined;
  resetToSeed: () => void;
}

/** Store seeded from the mock catalog. New accelerators created in-app are
 *  appended and persisted to localStorage so they survive reloads. */
export const useAcceleratorStore = create<AcceleratorState>()(
  persist(
    (set, get) => ({
      accelerators: MOCK_ACCELERATORS,
      addAccelerator: (a) =>
        set((s) => ({ accelerators: [a, ...s.accelerators] })),
      getBySlug: (slug) => get().accelerators.find((x) => x.slug === slug),
      resetToSeed: () => set({ accelerators: MOCK_ACCELERATORS }),
    }),
    {
      name: 'datalens-accelerators',
      // Only persist user-created ones would be ideal, but simplest: persist all.
      // On version bumps we could merge seed + persisted; fine for now.
    },
  ),
);
