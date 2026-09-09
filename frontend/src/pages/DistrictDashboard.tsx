import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { RiskBadge } from '../components/RiskBadge';
import { RiskWorklist } from '../components/RiskWorklist';
import { WorkDetailPanel } from '../components/WorkDetailPanel';
import { 
  useDashboardSummary, 
  useRiskRanked, 
  useWorks, 
  useWorkDetail 
} from '../hooks/useApi';
import { getStoredScope } from '../api/client';
import { 
  Building2, 
  AlertTriangle, 
  ShieldAlert,
  Copy, 
  IndianRupee, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export const DistrictDashboard: React.FC = () => {
  const scope = getStoredScope();
  const districtName = scope.district || 'Assigned District';
  const stateName = scope.state || '';

  const { data: summary, loading: summaryLoading } = useDashboardSummary();
  const { data: rankedWorks, loading: rankedLoading } = useRiskRanked(10);
  
  const [page, setPage] = useState(1);
  const [selectedRiskBand, setSelectedRiskBand] = useState<string>('');

  const { data: worksData, loading: worksLoading } = useWorks({
    page,
    page_size: 15,
    risk_band: selectedRiskBand || undefined,
  });

  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const { data: workDetail } = useWorkDetail(selectedWorkId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            District Authority Portal
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
            {districtName} District Authority Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            District Collector & Nodal Agency Oversight • {districtName}, {stateName}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs border-l-4 border-l-blue-500 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Works in {districtName}</span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 group-hover:scale-105 transition-transform duration-200">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 font-mono mt-2">
              {summaryLoading ? '...' : summary?.total_works?.toLocaleString('en-IN') || 0}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">Under district execution</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs border-l-4 border-l-rose-500 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">District Flagged Works</span>
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 group-hover:scale-105 transition-transform duration-200">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-rose-600 font-mono mt-2">
              {summaryLoading ? '...' : summary?.flagged_count?.toLocaleString('en-IN') || 0}
            </div>
            <div className="text-[11px] font-medium text-rose-500 mt-1">Collector review needed</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xs border-l-4 border-l-amber-500 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">District Avg Risk</span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 group-hover:scale-105 transition-transform duration-200">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 font-mono mt-2">
              {summaryLoading ? '...' : `${summary?.avg_risk_score || 0} / 100`}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">Weighted composite score</div>
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
            <div className="text-[11px] font-medium text-slate-400 mt-1">Expenditure progress</div>
          </div>
        </div>

        {/* Priority Anomaly Works in District */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Highest Risk Works in {districtName}</h2>
              <p className="text-xs text-slate-400">Works flagged for potential duplicate sanctions, cost escalation, or timeline stall</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3">Work ID</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Risk Assessment</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rankedLoading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading works...</td></tr>
                ) : (rankedWorks || []).map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedWorkId(item.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">#{item.id}</td>
                    <td className="px-6 py-3.5 text-slate-700">{item.category}</td>
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

        {/* District Risk Worklist */}
        <RiskWorklist
          works={worksData?.items || []}
          totalCount={worksData?.total_count || 0}
          loading={worksLoading}
          summary={summary}
          summaryLoading={summaryLoading}
          selectedRiskBand={selectedRiskBand}
          onRiskBandChange={(band) => { setSelectedRiskBand(band); setPage(1); }}
          page={page}
          onPageChange={(p) => setPage(p)}
          pageSize={15}
          onSelectWork={(id) => setSelectedWorkId(id)}
          title={`All Works Ledger in ${districtName}`}
          subtitle={`Complete execution monitoring and anomaly ranking for ${districtName}, ${stateName}`}
        />
      </main>

      <WorkDetailPanel
        work={workDetail}
        isOpen={selectedWorkId !== null}
        onClose={() => setSelectedWorkId(null)}
        onSelectWork={(id) => setSelectedWorkId(id)}
      />
    </div>
  );
};
