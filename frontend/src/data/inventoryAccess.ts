/** Persona / role-based access for the Inventory Optimization accelerator.
 *  Task-first IA: Review · Approvals · Impact · Plants · Forecast · Digital Twin · Ask · Admin.
 *  The LEAP reference ran as one "Global Access" super-admin; Inventory Optimization segregates by persona.
 */
import { useAuthStore } from '../store/authStore';

export type InvRole = 'admin' | 'manager' | 'analyst';

export interface InvAccess {
  role: InvRole;
  persona: string;   // shown in the shell
  scope: string;     // data-scope label
  navKeys: Set<string>;        // nav destination keys this role may open
  approvalStages: string[];    // approval stages this role may ACT on
  canApprove: boolean;         // can act in Approvals at all
}

const ALL_NAV = ['home', 'review', 'approvals', 'risk', 'impact', 'plants', 'forecast', 'savings', 'opportunity', 'digital-twin', 'ask', 'settings', 'users', 'data-sources'];
const ADMIN_ONLY = ['settings', 'users', 'data-sources'];
// Plant Engineer's screen set (their assigned plants only).
const ANALYST_NAV = ['home', 'review', 'approvals', 'plants', 'forecast', 'risk', 'savings', 'opportunity', 'ask'];

export function accessFor(authRole: 'admin' | 'manager' | 'user' | undefined): InvAccess {
  if (authRole === 'admin') {
    return {
      role: 'admin', persona: 'Platform Admin', scope: 'Global access',
      navKeys: new Set(ALL_NAV),
      approvalStages: ['pending', 'eng', 'fin', 'reg', 'glob'],
      canApprove: true,
    };
  }
  if (authRole === 'manager') {
    return {
      role: 'manager', persona: 'Manager', scope: 'Regional oversight',
      navKeys: new Set(ALL_NAV.filter((k) => !ADMIN_ONLY.includes(k))),
      approvalStages: ['fin', 'reg', 'glob'],
      canApprove: true,
    };
  }
  return {
    role: 'analyst', persona: 'Analyst', scope: 'Assigned plants · read + propose',
    navKeys: new Set(ANALYST_NAV),
    approvalStages: [],
    canApprove: false,
  };
}

export function useInvAccess(): InvAccess {
  const user = useAuthStore((s) => s.user);
  return accessFor(user?.role);
}
