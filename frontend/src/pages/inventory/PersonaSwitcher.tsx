import { useState } from 'react';
import { ChevronDown, Check, Users } from 'lucide-react';
import { PERSONAS, type PersonaId } from './personas';

/** Floating persona switcher — swap vantage point across the workflow chain. */
export default function PersonaSwitcher({ persona, onChange }: { persona: PersonaId; onChange: (p: PersonaId) => void }) {
  const [open, setOpen] = useState(false);
  const current = PERSONAS.find((p) => p.id === persona) || PERSONAS[0];

  return (
    <div className="fixed left-1/2 top-2 z-50 -translate-x-1/2">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full border border-navy-200 bg-white/95 px-3 py-1.5 text-[12px] shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#1b1730]/95">
        <Users className="h-3.5 w-3.5 text-accent-500" />
        <span className="font-semibold">{current.name}</span>
        <span className="hidden text-[10.5px] text-navy-400 dark:text-slate-500 sm:inline">· vantage point</span>
        <ChevronDown className={`h-3.5 w-3.5 text-navy-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 z-50 mt-1.5 w-72 -translate-x-1/2 rounded-xl border border-navy-100 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-[#1b1730]">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-navy-400 dark:text-slate-500">Switch persona</div>
            {PERSONAS.map((p) => {
              const active = p.id === persona;
              return (
                <button key={p.id} disabled={!p.built} onClick={() => { if (p.built) { onChange(p.id); setOpen(false); } }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${active ? 'bg-accent-500/10' : p.built ? 'hover:bg-navy-50 dark:hover:bg-slate-800' : 'cursor-not-allowed opacity-55'}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${active ? 'bg-accent-500 text-white' : 'bg-navy-100 text-navy-500 dark:bg-slate-800 dark:text-slate-400'}`}>{p.short}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold">{p.name}</span><span className="block truncate text-[10.5px] text-navy-400 dark:text-slate-500">{p.role}</span></span>
                  {active ? <Check className="h-4 w-4 text-accent-500" /> : !p.built && <span className="rounded-full bg-navy-100 px-1.5 py-0.5 text-[9px] font-semibold text-navy-400 dark:bg-slate-800 dark:text-slate-500">soon</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
