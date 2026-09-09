import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { HeatMap } from '../components/HeatMap';
import { RiskBadge } from '../components/RiskBadge';
import { RiskWorklist } from '../components/RiskWorklist';
import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { 
  useDashboardSummary, 
  useRiskRanked, 
  useWorks, 
  useWorkDetail 
} from '../hooks/useApi';
import { 
  Building2, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  IndianRupee, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';

export const MinistryDashboard: React.FC = () => {
  const { data: summary, loading: summaryLoading } = useDashboardSummary();
  const { data: rankedWorks, loading: rankedLoading } = useRiskRanked(15);
  
  // Works list filter state
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedRiskBand, setSelectedRiskBand] = useState<string>('');
  const [filterDistrict, setFilterDistrict] = useState<string>('');

  const { data: worksData, loading: worksLoading } = useWorks({
    page,
    page_size: 15,
    category: selectedCategory || undefined,
    risk_band: selectedRiskBand || undefined,
    district: filterDistrict || undefined,
  });

  // Selected work for inspection drawer
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const { data: workDetail } = useWorkDetail(selectedWorkId);


  const formatCurrency = (val?: number | null) => {
    if (!val) return '0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title & Scope Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              National Oversight Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time monitoring and anomaly detection across all 544 Parliamentary Constituencies
            </p>
          </div>

          {filterDistrict && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <span>Filtered by District: <strong>{filterDistrict}</strong></span>
              <button 
                onClick={() => setFilterDistrict('')}
                className="text-blue-500 hover:text-blue-800 font-bold ml-1"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* 1. KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs border-l-4 border-l-blue-500 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Sanctioned Works</span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 group-hover:scale-105 transition-transform duration-200">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 font-mono mt-2">
              {summaryLoading ? '...' : summary?.total_works?.toLocaleString('en-IN') || 0}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">Across 10 work categories</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs border-l-4 border-l-rose-500 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Flagged Anomalies</span>
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 group-hover:scale-105 transition-transform duration-200">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-rose-600 font-mono mt-2">
              {summaryLoading ? '...' : summary?.flagged_count?.toLocaleString('en-IN') || 0}
            </div>
            <div className="text-[11px] font-medium text-rose-500 mt-1">Requires audit review</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs border-l-4 border-l-amber-500 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">System Avg Risk Score</span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 group-hover:scale-105 transition-transform duration-200">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 font-mono mt-2">
              {summaryLoading ? '...' : `${summary?.avg_risk_score || 0} / 100`}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">40% Cost, 30% Dup, 30% Delay</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs border-l-4 border-l-emerald-500 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fund Utilisation</span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform duration-200">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-emerald-600 font-mono mt-2">
              {summaryLoading ? '...' : `${summary?.fund_utilisation_pct || 0}%`}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">Released vs Sanctioned</div>
          </div>
        </div>

        {/* 2. Geographic Anomaly Heat Map */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs transition-all duration-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">National Anomaly Density Heat Map</h2>
              <p className="text-xs text-slate-500">
                594 Indian districts mapped with boundary geometries. Hover to view district metrics, click to filter.
              </p>
            </div>
            {filterDistrict && (
              <button
                onClick={() => setFilterDistrict('')}
                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-semibold transition-all duration-150 cursor-pointer"
              >
                Reset Map Filter
              </button>
            )}
          </div>

          <HeatMap 
            onSelectDistrict={(dist) => {
              setFilterDistrict(dist);
              setPage(1);
            }}
            selectedDistrict={filterDistrict}
          />
        </div>

        {/* 3. Analytics Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs transition-all duration-200">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Anomalies by Work Category</h2>
            <p className="text-xs text-slate-400 mb-4">Distribution of audit flags across infrastructure sectors</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.category_breakdown || []} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                  <XAxis dataKey="category" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10 }} height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }} 
                  />
                  <Bar dataKey="flagged_count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Flagged Works" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6-Month Trend */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs transition-all duration-200">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Monthly Anomaly Trend</h2>
            <p className="text-xs text-slate-400 mb-4">6-month detection timeline based on flag creation dates</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary?.trend || []} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }} 
                  />
                  <Line type="monotone" dataKey="flagged_count" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 4 }} name="Flagged Works" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 4. Top Risk-Ranked Works Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Highest Risk Priority Works</h2>
              <p className="text-xs text-slate-400">Top anomalous projects scored across cost, duplicate, delay, and hard rules</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-200">
              National Top 15
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3">Work ID</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Risk Assessment</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rankedLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading risk-ranked works...</td>
                  </tr>
                ) : (rankedWorks || []).map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedWorkId(item.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">#{item.id}</td>
                    <td className="px-6 py-3.5 text-slate-700">{item.category}</td>
                    <td className="px-6 py-3.5 text-slate-600">{item.district}, {item.state}</td>
                    <td className="px-6 py-3.5">
                      <RiskBadge band={item.risk_band} score={item.risk_score} showScore={true} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWorkId(item.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-all duration-150 cursor-pointer"
                      >
                        <span>Audit Detail</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Complete Works Directory with RiskWorklist */}
        <RiskWorklist
          works={worksData?.items || []}
          totalCount={worksData?.total_count || 0}
          loading={worksLoading}
          summary={summary}
          summaryLoading={summaryLoading}
          selectedRiskBand={selectedRiskBand}
          onRiskBandChange={(band) => { setSelectedRiskBand(band); setPage(1); }}
          selectedCategory={selectedCategory}
          onCategoryChange={(cat) => { setSelectedCategory(cat); setPage(1); }}
          categories={(summary?.category_breakdown || []).map((c) => c.category)}
          page={page}
          onPageChange={(p) => setPage(p)}
          pageSize={15}
          onSelectWork={(id) => setSelectedWorkId(id)}
          title="National Works Ledger & Risk Worklist"
          subtitle="Real-time multi-detector anomaly ranking across all 544 Parliamentary Constituencies"
        />
      </main>

      {/* Shared WorkDetailPanel Drawer */}
      <WorkDetailPanel
        work={workDetail}
        isOpen={selectedWorkId !== null}
        onClose={() => setSelectedWorkId(null)}
        onSelectWork={(id) => setSelectedWorkId(id)}
      />
    </div>
  );
};
