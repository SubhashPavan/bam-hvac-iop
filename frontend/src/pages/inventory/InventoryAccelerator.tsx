import { useCallback, useEffect, useState } from 'react';
import PlantEngineerWorkspace from './PlantEngineerWorkspace';
import MaintenanceLeaderWorkspace from './MaintenanceLeaderWorkspace';
import FinanceControllerWorkspace from './FinanceControllerWorkspace';
import ProgramExecutiveWorkspace from './ProgramExecutiveWorkspace';
import AdminWorkspace from './AdminWorkspace';
import type { PersonaId } from './personas';
import { loadInventoryBase } from '../../services/inventoryApi';
import { hydrateInventory } from '../../data/inventoryMock';

/** Entry point for the Inventory Optimization accelerator — routes to the
 *  workspace for the selected persona (switchable in-app).
 *
 *  On mount it hydrates the shared in-memory dataset from the live backend
 *  (plants + materials + recommendations). Every derived view then reflects
 *  live seeded — or ingested — data. If the backend is unreachable the app
 *  keeps the deterministic mock, so the demo never breaks. `key={dataVersion}`
 *  remounts the workspace once, when live data arrives, to re-derive charts. */
export default function InventoryAccelerator() {
  const [persona, setPersona] = useState<PersonaId>('plant_manager');
  const [dataVersion, setDataVersion] = useState(0);

  const rehydrate = useCallback(() => loadInventoryBase()
    .then((base) => { hydrateInventory(base); setDataVersion((v) => v + 1); })
    .catch(() => { /* backend down → keep current data */ }), []);

  useEffect(() => { rehydrate(); }, [rehydrate]);

  const props = { persona, onPersona: setPersona };
  const k = dataVersion;
  if (persona === 'maintenance_leader') return <MaintenanceLeaderWorkspace key={k} {...props} />;
  if (persona === 'finance_controller') return <FinanceControllerWorkspace key={k} {...props} />;
  if (persona === 'program_executive') return <ProgramExecutiveWorkspace key={k} {...props} />;
  if (persona === 'admin') return <AdminWorkspace key={k} {...props} onDataChange={rehydrate} />;
  return <PlantEngineerWorkspace key={k} {...props} />;
}
