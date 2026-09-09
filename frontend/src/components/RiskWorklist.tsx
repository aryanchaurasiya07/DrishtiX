import React, { useState, useMemo } from 'react';
import { WorkListItem, DashboardSummary } from '../api/types';
import { RiskBadge } from './RiskBadge';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  ChevronLeft, 
  ChevronRight,
  ArrowRight
} from 'lucide-react';

export interface RiskWorklistProps {
  works: WorkListItem[];
  totalCount?: number;
  loading?: boolean;
  summary?: DashboardSummary | null;
  summaryLoading?: boolean;
  selectedRiskBand?: string;
  onRiskBandChange?: (band: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  categories?: string[];
  page?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onSelectWork: (workId: number) => void;
  title?: string;
  subtitle?: string;
}

type SortField = 'id' | 'category' | 'district' | 'risk_score';
type SortOrder = 'asc' | 'desc';

export const RiskWorklist: React.FC<RiskWorklistProps> = ({
  works = [],
  totalCount,
  loading = false,
  summary,
  summaryLoading = false,
  selectedRiskBand = '',
  onRiskBandChange,
  selectedCategory = '',
  onCategoryChange,
  categories = [],
  page = 1,
  onPageChange,
  pageSize = 15,
  onSelectWork,
  title = 'Risk-Ranked Worklist',
  subtitle = 'Sorted Red → Amber → Green by composite anomaly severity',
}) => {
  // Local text search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sort state — default: risk_score descending (Red -> Amber -> Green)
  const [sortField, setSortField] = useState<SortField>('risk_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Handle header sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // For risk_score default to desc (highest risk first); for text/id default to asc
      setSortOrder(field === 'risk_score' ? 'desc' : 'asc');
    }
  };

  // Filtered & Sorted items
  const processedWorks = useMemo(() => {
    let result = [...works];

    // Client-side search filtering
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((w) => 
        String(w.id).includes(q) ||
        w.category?.toLowerCase().includes(q) ||
        w.district?.toLowerCase().includes(q) ||
        w.state?.toLowerCase().includes(q) ||
        w.mp_name?.toLowerCase().includes(q)
      );
    }

    // Client-side sorting (ensuring Red -> Amber -> Green ordering by risk_score by default)
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'risk_score') {
        const scoreA = a.risk_score ?? -1;
        const scoreB = b.risk_score ?? -1;
        comparison = scoreA - scoreB;
      } else if (sortField === 'id') {
        comparison = a.id - b.id;
      } else if (sortField === 'category') {
        comparison = (a.category || '').localeCompare(b.category || '');
      } else if (sortField === 'district') {
        comparison = (a.district || '').localeCompare(b.district || '');
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [works, searchTerm, sortField, sortOrder]);

  // Derived counts for top stat cards
  const statCounts = useMemo(() => {
    const flagged = summary?.flagged_count ?? works.filter((w) => w.risk_band === 'red' || w.risk_band === 'amber').length;
    const red = summary?.red_count ?? works.filter((w) => w.risk_band === 'red').length;
    const amber = summary?.amber_count ?? works.filter((w) => w.risk_band === 'amber').length;
    const green = summary?.green_count ?? works.filter((w) => w.risk_band === 'green').length;
    const total = summary?.total_works ?? totalCount ?? works.length;

    const batch = summary?.batch_entry_review_count ?? 0;
    return { flagged, red, amber, green, total, batch };
  }, [summary, works, totalCount]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-blue-600 ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-blue-600 ml-1" />
    );
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. STAT CARD ROW (Reference Image 2 Pattern)
          Lead card = "Flagged Works"
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Lead Card: Flagged Works */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-rose-500 shadow-sm hover:shadow-xs transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Flagged Works
            </span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 group-hover:scale-105 transition-transform duration-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono mt-2 tracking-tight">
            {summaryLoading ? '...' : statCounts.flagged.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-rose-500 font-medium mt-1">
            Requires audit review
          </div>
        </div>

        {/* Card 2: High Priority (Red) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-rose-400 shadow-sm hover:shadow-xs transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              High Priority (Red)
            </span>
            <div className="p-2.5 bg-rose-50/60 text-rose-600 rounded-xl border border-rose-100 group-hover:scale-105 transition-transform duration-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono mt-2 tracking-tight">
            {summaryLoading ? '...' : statCounts.red.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Severe anomaly score (≥70)
          </div>
        </div>

        {/* Card 3: Review Needed (Amber) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-amber-500 shadow-sm hover:shadow-xs transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Review Needed (Amber)
            </span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 group-hover:scale-105 transition-transform duration-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-2 tracking-tight">
            {summaryLoading ? '...' : statCounts.amber.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Rules, split tenders & delays
          </div>
        </div>

        {/* Card 4: Low Risk (Green) / Verified */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-xs transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Low Risk (Green)
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 group-hover:scale-105 transition-transform duration-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-2 tracking-tight">
            {summaryLoading ? '...' : statCounts.green.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Normal operational variance
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. WORKLIST CONTAINER (Reference Image 1 Table Pattern)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header & Tabs */}
        <div className="px-6 pt-5 pb-0 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>

            {/* Live Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search works, category, MP..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Underline Tabs (All, Red, Amber, Green) */}
          <div className="flex items-center gap-6 text-xs font-semibold overflow-x-auto -mb-px">
            {[
              { id: '', label: 'All Works' },
              { id: 'red', label: 'High Priority (Red)' },
              { id: 'amber', label: 'Review Needed (Amber)' },
              { id: 'green', label: 'Low Risk (Green)' },
            ].map((tab) => {
              const active = selectedRiskBand === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onRiskBandChange && onRiskBandChange(tab.id)}
                  className={`pb-3 pt-1 border-b-2 font-medium transition-all duration-200 ease-in-out ${
                    active
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter Sub-bar (if categories provided) */}
        {categories.length > 0 && onCategoryChange && (
          <div className="px-6 py-2.5 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Filter by Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden transition-colors duration-150"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            3. TABLE WITH SORTABLE HEADERS & ROW HOVER STATES
            ───────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px] select-none">
              <tr>
                <th 
                  onClick={() => handleSort('id')} 
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 transition-colors duration-150"
                >
                  <div className="flex items-center">
                    <span>Work ID</span>
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('category')} 
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 transition-colors duration-150"
                >
                  <div className="flex items-center">
                    <span>Category</span>
                    {renderSortIcon('category')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('district')} 
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 transition-colors duration-150"
                >
                  <div className="flex items-center">
                    <span>Location & MP</span>
                    {renderSortIcon('district')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('risk_score')} 
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 transition-colors duration-150"
                >
                  <div className="flex items-center">
                    <span>Risk Assessment</span>
                    {renderSortIcon('risk_score')}
                  </div>
                </th>
                <th className="px-6 py-3.5 text-right">
                  <span>Action</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading works ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : processedWorks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No works found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                processedWorks.map((work) => (
                  <tr
                    key={work.id}
                    onClick={() => onSelectWork(work.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors duration-150 ease-in-out group"
                  >
                    {/* Work ID */}
                    <td className="px-6 py-3.5 font-bold text-slate-900 font-mono">
                      #{work.id}
                    </td>

                    {/* Category + top reason */}
                    <td className="px-6 py-3.5 text-slate-800 font-medium max-w-xs">
                      <div className="truncate">{work.category}</div>
                      {(work as any).top_reason && (
                        <div className="text-[10px] text-slate-400 italic font-normal mt-0.5 truncate max-w-[220px]">
                          ↳ {(work as any).top_reason}
                        </div>
                      )}
                    </td>

                    {/* Location & MP */}
                    <td className="px-6 py-3.5 text-slate-600">
                      <div className="font-semibold text-slate-800">
                        {work.district}{work.state ? `, ${work.state}` : ''}
                      </div>
                      {work.mp_name && (
                        <div className="text-[11px] text-slate-400 font-normal">
                          {work.mp_name}
                        </div>
                      )}
                    </td>

                    {/* Risk Assessment Badge */}
                    <td className="px-6 py-3.5">
                      <RiskBadge 
                        band={work.risk_band} 
                        score={work.risk_score} 
                        showScore={true} 
                      />
                    </td>

                    {/* Action Button */}
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWork(work.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-xs font-semibold transition-all duration-200 ease-in-out"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors duration-150" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. PAGINATION FOOTER
            ───────────────────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{processedWorks.length}</strong> of{' '}
            <strong className="text-slate-800">{totalCount ?? processedWorks.length}</strong> works
          </div>

          {onPageChange && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ease-in-out"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold px-2 text-slate-700">Page {page}</span>
              <button
                type="button"
                disabled={Boolean(totalCount && page * pageSize >= totalCount)}
                onClick={() => onPageChange(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ease-in-out"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
