export type PersonaId = 'plant_manager' | 'maintenance_leader' | 'finance_controller' | 'program_executive' | 'admin';

export interface Persona { id: PersonaId; name: string; role: string; short: string; built: boolean }

export const PERSONAS: Persona[] = [
  { id: 'plant_manager', name: 'Plant Manager', role: 'Finds & originates · approves Stage 1', short: 'PM', built: true },
  { id: 'maintenance_leader', name: 'Maintenance Leader', role: 'Plans & executes · approves Stage 2', short: 'ML', built: true },
  { id: 'finance_controller', name: 'Finance Controller', role: 'Financial sign-off · Stage 3', short: 'FC', built: true },
  { id: 'program_executive', name: 'Program Executive', role: 'Regional / global oversight', short: 'PE', built: true },
  { id: 'admin', name: 'Admin', role: 'Platform administration & data', short: 'AD', built: true },
];
