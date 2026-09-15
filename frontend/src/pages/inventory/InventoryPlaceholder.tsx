import { useLocation } from 'react-router-dom';
import { Hammer } from 'lucide-react';

const TITLES: Record<string, string> = {
  executive: 'Executive Dashboard', global: 'Global View', 'control-tower': 'Control Tower',
  'inventory-analytics': 'Inventory Analytics', 'material-intelligence': 'Material Intelligence',
  'opportunity-finder': 'Opportunity Finder', 'savings-tracker': 'Savings Tracker',
  forecasting: 'Demand Forecasting', 'digital-twin': 'Digital Twin', copilot: 'AI Copilot',
  approvals: 'Approval Workflow', plant: 'Plant Dashboard', finance: 'Finance View', risk: 'Risk Monitor',
  users: 'User Management', 'data-sources': 'Data Sources', settings: 'Settings', export: 'Download Presentation',
};

export default function InventoryPlaceholder() {
  const seg = useLocation().pathname.split('/').pop() || '';
  const title = TITLES[seg] || 'Screen';
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 text-accent-600 dark:text-accent-400">
        <Hammer className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-[19.5px] font-semibold">{title}</h1>
        <p className="mt-1 text-[14.5px] text-navy-500 dark:text-slate-500">This screen is next in the build plan — coming soon.</p>
      </div>
    </div>
  );
}
