import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Action & approval-workflow store for the Inventory Optimization accelerator.
 *
 * The spine: an insight/opportunity → a structured Request → routed through
 * the approval chain (Plant Manager → Maintenance → Finance → Regional →
 * Global → execution). Simulation snapshots attach as evidence.
 *
 * Client-side + persisted for the demo; swap for the backend workflow API later.
 */

export type ActionKind = 'reduce_stock' | 'dispose' | 'increase_stock' | 'rebalance' | 'transfer' | 'expedite' | 'param_change';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Routing = 'maintenance_planner' | 'email' | 'save_execute';
export type Stage = 'plant_mgr' | 'maintenance' | 'finance' | 'regional' | 'global' | 'executing' | 'done' | 'rejected';

export const STAGE_FLOW: Stage[] = ['plant_mgr', 'maintenance', 'finance', 'regional', 'global', 'executing', 'done'];
export const STAGE_LABEL: Record<Stage, string> = {
  plant_mgr: 'Plant Manager', maintenance: 'Maintenance Planner', finance: 'Finance Controller',
  regional: 'Regional Exec', global: 'Global Exec', executing: 'In execution', done: 'Done', rejected: 'Rejected',
};
export const ACTION_LABEL: Record<ActionKind, string> = {
  reduce_stock: 'Reduce stock', dispose: 'Dispose / write-off', increase_stock: 'Increase stock',
  rebalance: 'Rebalance', transfer: 'Transfer between plants', expedite: 'Expedite', param_change: 'Adjust reorder policy',
};

export interface SimSnapshot { scenario: string; service: number; investment: number; stockoutRisk: number; savedAt: string }
export interface HistoryEntry { stage: Stage; actor: string; decision: 'created' | 'approved' | 'rejected' | 'commented' | 'sent_back'; comment?: string; at: string }
export interface ActionSeed {
  materialId: string; materialDesc: string; plantId: string; kind: ActionKind;
  currentValue: number; proposedValue: number; savings: number; cashRelease: number; justification: string;
  snapshot?: SimSnapshot | null;
}
export interface ActionRequest extends ActionSeed {
  id: string; createdAt: string; note: string; priority: Priority; routing: Routing;
  stage: Stage; history: HistoryEntry[]; snapshot: SimSnapshot | null;
}

const now = () => new Date().toISOString();

interface RequestState {
  requests: ActionRequest[];
  seq: number;
  draft: ActionSeed | null;
  pendingSnapshot: SimSnapshot | null;
  openAction: (seed: ActionSeed) => void;
  closeAction: () => void;
  saveSnapshot: (s: SimSnapshot) => void;
  clearSnapshot: () => void;
  create: (opts: { seed: ActionSeed; note: string; priority: Priority; routing: Routing }) => ActionRequest;
  decide: (id: string, decision: 'approved' | 'rejected', actor: string, comment?: string) => void;
  sendBack: (id: string, actor: string, comment?: string) => void;
  addComment: (id: string, actor: string, comment: string) => void;
}

export const useRequestStore = create<RequestState>()(
  persist(
    (set, get) => ({
      requests: [],
      seq: 1,
      draft: null,
      pendingSnapshot: null,
      openAction: (seed) => set((s) => ({ draft: { ...seed, snapshot: seed.snapshot ?? s.pendingSnapshot } })),
      closeAction: () => set({ draft: null }),
      saveSnapshot: (snap) => set({ pendingSnapshot: snap }),
      clearSnapshot: () => set({ pendingSnapshot: null }),
      create: ({ seed, note, priority, routing }) => {
        const id = `REQ-${1000 + get().seq}`;
        const req: ActionRequest = {
          ...seed, id, note, priority, routing,
          createdAt: now(),
          snapshot: seed.snapshot ?? null,
          // Plant Manager originates (Stage 1 done) → routes to Maintenance next.
          stage: 'maintenance',
          history: [{ stage: 'plant_mgr', actor: 'You · Plant Manager', decision: 'created', at: now() }],
        };
        set((s) => ({ requests: [req, ...s.requests], seq: s.seq + 1, draft: null, pendingSnapshot: null }));
        return req;
      },
      decide: (id, decision, actor, comment) => set((s) => ({
        requests: s.requests.map((q) => {
          if (q.id !== id) return q;
          const history = [...q.history, { stage: q.stage, actor, decision, comment, at: now() }];
          if (decision === 'rejected') return { ...q, stage: 'rejected' as Stage, history };
          const next = STAGE_FLOW[Math.min(STAGE_FLOW.indexOf(q.stage) + 1, STAGE_FLOW.length - 1)];
          return { ...q, stage: next, history };
        }),
      })),
      sendBack: (id, actor, comment) => set((s) => ({
        requests: s.requests.map((q) => {
          if (q.id !== id) return q;
          const history = [...q.history, { stage: q.stage, actor, decision: 'sent_back' as const, comment, at: now() }];
          const prev = STAGE_FLOW[Math.max(0, STAGE_FLOW.indexOf(q.stage) - 1)];
          return { ...q, stage: prev, history };
        }),
      })),
      addComment: (id, actor, comment) => set((s) => ({
        requests: s.requests.map((q) => q.id === id ? { ...q, history: [...q.history, { stage: q.stage, actor, decision: 'commented' as const, comment, at: now() }] } : q),
      })),
    }),
    { name: 'inv-opt-requests', partialize: (s) => ({ requests: s.requests, seq: s.seq }) },
  ),
);
