import React from 'react';
import { Navbar } from '../components/Navbar';
import { 
  Database,
  Eye,
  EyeOff,
  CheckCircle2,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { apiClient } from '../api/client';
import { useState, useEffect } from 'react';

interface DataGap {
  field: string;
  missing_count: number;
  missing_pct: number;
}

interface StateCoverage {
  state: string;
  total_works: number;
  measurable_count: number;
  measurable_pct: number;
}

interface CoverageSummary {
  total_works: number;
  measurable_count: number;
  partially_measurable_count: number;
  not_measurable_count: number;
  gaps: DataGap[];
  band_distribution: Record<string, number>;
  state_coverage: StateCoverage[];
}

const FIELD_LABELS: Record<string, { label: string; description: string }> = {
  completion_date: {
    label: 'Completion Date',
    description: 'actual_completion column — needed for delay scoring and work closeout verification.',
  },
  expenditure: {
    label: 'Expenditure Record',
    description: 'expenditure column — needed for fund-utilisation and payment pattern analysis.',
  },
  agency: {
    label: 'Implementing Agency',
    description: 'agency_id column — needed for vendor-concentration and attribution analysis.',
  },
};

export const CoverageDashboard: React.FC = () => {
  const [data, setData] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<CoverageSummary>('/coverage/summary')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || e.message || 'Failed to load coverage data'))
      .finally(() => setLoading(false));
  }, []);

  const pct = (n: number, total: number) =>
    total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Coverage &amp; Data Quality
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Which works can this system actually score — and where is the data missing?
          </p>
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950">
            <p className="font-bold text-sm mb-1">A grey "Not Measurable" badge ≠ a clean work</p>
            <p>
              When a work is labelled <strong>Not Measurable</strong>, it means DrishtiX lacked
              sufficient data to score it — not that the work is risk-free.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading coverage data…</div>
        ) : error ? (
          <div className="text-center py-12 text-rose-500 text-sm">{error}</div>
        ) : data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-blue-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Works</span>
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Database className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black tracking-tight text-slate-900 font-mono mt-2">
                  {data.total_works.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1">Full dataset in Supabase</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fully Measurable</span>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black tracking-tight text-emerald-600 font-mono mt-2">
                  {data.measurable_count.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-medium text-emerald-600 mt-1">
                  {pct(data.measurable_count, data.total_works)}% — all 3 data dimensions present
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-amber-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Partially Measurable</span>
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black tracking-tight text-amber-600 font-mono mt-2">
                  {data.partially_measurable_count.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-medium text-amber-600 mt-1">
                  {pct(data.partially_measurable_count, data.total_works)}% — 1–2 data dimensions present
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-slate-400 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Not Measurable</span>
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200">
                    <EyeOff className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black tracking-tight text-slate-500 font-mono mt-2">
                  {data.not_measurable_count.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1">
                  {pct(data.not_measurable_count, data.total_works)}% — insufficient data to score
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900">Missing Data by Field</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Each missing field reduces what the scoring system can evaluate for a given work.
                </p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left">Data Field</th>
                    <th className="px-6 py-3 text-left">Why It Matters</th>
                    <th className="px-6 py-3 text-right">Missing Count</th>
                    <th className="px-6 py-3 text-right">Missing %</th>
                    <th className="px-6 py-3 text-left">Coverage Bar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.gaps.map((gap) => {
                    const info = FIELD_LABELS[gap.field] || { label: gap.field, description: '' };
                    const presentPct = 100 - gap.missing_pct;
                    return (
                      <tr key={gap.field} className="hover:bg-slate-50">
                        <td className="px-6 py-3.5 font-bold text-slate-900">{info.label}</td>
                        <td className="px-6 py-3.5 text-slate-500 max-w-xs">{info.description}</td>
                        <td className="px-6 py-3.5 text-right font-mono text-slate-700">
                          {gap.missing_count.toLocaleString('en-IN')}
                        </td>
                        <td className={`px-6 py-3.5 text-right font-mono font-bold ${
                          gap.missing_pct > 40 ? 'text-rose-600' :
                          gap.missing_pct > 20 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {gap.missing_pct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${presentPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {presentPct.toFixed(1)}% present
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 mb-1">Risk Band Distribution</h2>
                <p className="text-xs text-slate-400 mb-4">Across all scored works in the database</p>
                <div className="space-y-3">
                  {[
                    { band: 'red', label: 'High Priority (Red)', color: 'bg-rose-500' },
                    { band: 'amber', label: 'Needs Review (Amber)', color: 'bg-amber-500' },
                    { band: 'green', label: 'Low Risk (Green)', color: 'bg-emerald-500' },
                    { band: 'insufficient_data', label: 'Not Measurable (Grey)', color: 'bg-slate-400' },
                  ].map(({ band, label, color }) => {
                    const count = data.band_distribution[band] || 0;
                    const total = Object.values(data.band_distribution).reduce((a, b) => a + b, 0);
                    const bandPct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={band}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">{label}</span>
                          <span className="font-mono text-slate-500">
                            {count.toLocaleString('en-IN')} ({bandPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full transition-all duration-500`}
                            style={{ width: `${bandPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 mb-1">State-Level Data Coverage</h2>
                <p className="text-xs text-slate-400 mb-4">% of works with all 3 data dimensions (top 20 states by volume)</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.state_coverage}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="state" tick={{ fontSize: 9 }} width={90} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.5rem', color: '#fff', fontSize: '11px' }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Coverage']}
                      />
                      <Bar dataKey="measurable_pct" radius={[0, 4, 4, 0]} maxBarSize={12}>
                        {data.state_coverage.map((entry) => (
                          <Cell
                            key={entry.state}
                            fill={entry.measurable_pct >= 70 ? '#10b981' : entry.measurable_pct >= 40 ? '#f59e0b' : '#f43f5e'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-3">How to interpret these numbers</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="font-bold text-emerald-800 mb-1">✅ Fully Measurable</div>
                  <p className="text-emerald-700">All three scoring dimensions available. Composite risk score is computed and reliable.</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="font-bold text-amber-800 mb-1">⚠️ Partially Measurable</div>
                  <p className="text-amber-700">Score is computed from available detectors only. Missing dimensions reduce coverage but do not mean the work is risk-free.</p>
                </div>
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                  <div className="font-bold text-slate-700 mb-1">🚫 Not Measurable</div>
                  <p className="text-slate-600">Insufficient data for any detector to run. Shown as grey badge. Does NOT mean the work is clean — it means the system cannot see it.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
