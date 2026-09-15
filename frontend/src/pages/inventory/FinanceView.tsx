import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DollarSign, TrendingDown, Gauge, PiggyBank } from 'lucide-react';
import { financeTotals } from '../../data/inventoryMock';

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`);

export default function FinanceView() {
  const fin = useMemo(() => financeTotals(), []);
  const roiData = [
    { year: 'Year 1', investment: 1.2, benefit: 4.1 },
    { year: 'Year 2', investment: 0.6, benefit: 6.2 },
    { year: 'Year 3', investment: 0.4, benefit: 7.4 },
  ];
  const cashData = [
    { year: 'Year 1', cash: 4.0 },
    { year: 'Year 2', cash: 9.5 },
    { year: 'Year 3', cash: 15.6 },
  ];
  const PRIORITY_TONE: Record<string, string> = {
    High: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    Low: 'bg-navy-100 text-navy-600 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-[20px] font-semibold tracking-tight">Finance Dashboard</h1>
        <p className="text-[14px] text-navy-500 dark:text-slate-500">Working capital · Cash release · ROI · NPV</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={DollarSign} tone="emerald" value={money(fin.wc_release)} label="Working Capital Release" sub="Unlockable from inventory" />
        <Kpi icon={TrendingDown} tone="amber" value={money(fin.savings)} label="Total Savings Identified" sub="AI-identified" />
        <Kpi icon={Gauge} tone="sky" value={`${fin.roi}×`} label="Project ROI" sub="Return on initiative" />
        <Kpi icon={PiggyBank} tone="violet" value={money(fin.npv)} label="3-Year NPV" sub="Net present value" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-2 text-[14.5px] font-semibold">3-Year ROI Projection</div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-navy-100 dark:text-slate-800" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}M`} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                <Tooltip formatter={(v) => `$${Number(v)}M`} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="investment" name="Investment" fill="#f97316" radius={[3, 3, 0, 0]} />
                <Bar dataKey="benefit" name="Benefit" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
          <div className="mb-2 text-[14.5px] font-semibold">Cumulative Cash Release</div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-navy-100 dark:text-slate-800" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}M`} stroke="currentColor" className="text-navy-400 dark:text-slate-500" />
                <Tooltip formatter={(v) => `$${Number(v)}M`} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="cash" name="Cash release" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white dark:border-slate-800 dark:bg-[#211c33]">
        <div className="border-b border-navy-100 px-4 py-3 text-[14.5px] font-semibold dark:border-slate-800">Regional Working Capital Release</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="border-b border-navy-100 text-left text-[11.5px] uppercase tracking-wide text-navy-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Region</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total Inventory</th>
                <th className="px-3 py-2.5 text-right font-semibold">Savings Identified</th>
                <th className="px-3 py-2.5 text-right font-semibold">WC Release</th>
                <th className="px-3 py-2.5 text-right font-semibold">Cash Flow Benefit</th>
                <th className="px-3 py-2.5 text-right font-semibold">ROI</th>
                <th className="px-4 py-2.5 text-center font-semibold">Priority</th>
              </tr>
            </thead>
            <tbody>
              {fin.regions.map((r) => (
                <tr key={r.region} className="border-b border-navy-50 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-2.5 font-medium">{r.region}</td>
                  <td className="px-3 py-2.5 text-right">{money(r.total_inventory)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">{money(r.savings)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{money(r.wc_release)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{money(r.cash_benefit)}</td>
                  <td className="px-3 py-2.5 text-right text-sky-600 dark:text-sky-400">{r.roi}×</td>
                  <td className="px-4 py-2.5 text-center"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${PRIORITY_TONE[r.priority]}`}>{r.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
};
function Kpi({ icon: Icon, tone, value, label, sub }: { icon: typeof DollarSign; tone: string; value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 dark:border-slate-800 dark:bg-[#211c33]">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE[tone]}`}><Icon className="h-4 w-4" /></span>
      <div className="mt-3 text-[26px] font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-[13.5px] font-medium">{label}</div>
      <div className="text-[12px] text-navy-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}
