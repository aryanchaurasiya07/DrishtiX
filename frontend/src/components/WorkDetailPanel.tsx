import React, { useState } from 'react';
import { WorkDetail } from '../api/types';
import { RiskBadge } from './RiskBadge';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  Clock, 
  IndianRupee, 
  Copy, 
  Calendar, 
  Building2, 
  MapPin, 
  CheckCircle2, 
  ExternalLink,
  ChevronLeft,
  Share2,
  FileText,
  TrendingUp,
  ShieldAlert,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

interface WorkDetailPanelProps {
  work: WorkDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectWork?: (workId: number) => void;
}

export const WorkDetailPanel: React.FC<WorkDetailPanelProps> = ({
  work,
  isOpen,
  onClose,
  onSelectWork,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'flags'>('overview');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !work) return null;

  const formatCurrency = (val?: number | null) => {
    if (val === null || val === undefined) return 'N/A';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const score = Math.max(0, Math.min(100, work.risk_scores?.risk_score || 0));
  const band = work.risk_scores?.risk_band || 'green';

  const costScore = work.risk_scores?.cost_score || 0;
  const dupScore = work.risk_scores?.duplicate_score || 0;
  const delayScore = work.risk_scores?.delay_score || 0;

  // Weighted score contributions (40%, 30%, 30%)
  const costContrib = costScore * 40;
  const dupContrib = dupScore * 30;
  const delayContrib = delayScore * 30;
  const totalContrib = costContrib + dupContrib + delayContrib;

  // Needle angle for SVG speedometer:
  // Score 0 -> -180 deg (left), Score 50 -> -90 deg (top), Score 100 -> 0 deg (right)
  const needleAngle = -180 + (score / 100) * 180;

  // Separate LLM summary from technical audit flags
  const llmSummaryFlag = work.flags.find((f) => f.source === 'llm_summary');
  const technicalFlags = work.flags.filter((f) => f.source !== 'llm_summary');

  // Flag detection summary for Warning Banner
  const isFlagged = technicalFlags.length > 0 || band === 'red' || band === 'amber';
  const flagSources = Array.from(new Set(technicalFlags.map((f) => f.source.replace('_', ' '))));
  const flagSummaryText = flagSources.length > 0 
    ? flagSources.slice(0, 2).join(' + ') + (flagSources.length > 2 ? ` + ${flagSources.length - 2} more` : '')
    : 'Anomaly patterns detected';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?work=${work.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const utilizationPct = (work.sanctioned_amt && work.expenditure)
    ? Math.min(100, (work.expenditure / work.sanctioned_amt) * 100).toFixed(1)
    : (work.released_amt && work.expenditure)
    ? Math.min(100, (work.expenditure / work.released_amt) * 100).toFixed(1)
    : '0.0';

  const remainingBalance = (work.sanctioned_amt && work.expenditure)
    ? Math.max(0, work.sanctioned_amt - work.expenditure)
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end transition-opacity duration-200">
      <div 
        className="w-full max-w-3xl bg-slate-50 shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ease-out"
        role="dialog"
        aria-modal="true"
      >
        {/* ─────────────────────────────────────────────────────────────
            1. TOP NAVIGATION / BREADCRUMB HEADER
            ───────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-all duration-150 ease-in-out"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Worklist</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-all duration-150 ease-in-out shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors duration-150"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. SCROLLABLE BODY
            ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Entity Profile Header (Reference Image 3 Pattern) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Work #{work.id}
                  </h1>
                  <RiskBadge band={band} score={score} showScore={true} />
                </div>
                <p className="text-xs text-slate-700 font-medium mt-1">
                  {work.category}
                </p>
                <p className="text-[10px] text-slate-400 italic mt-0.5">
                  Ranks works for human review — not a finding of wrongdoing.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {work.district}, {work.state}
                  </span>
                  {work.mp_id && (
                    <span
                      className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 font-medium"
                      title="Recommending MP (recommended the work, does not execute it)"
                    >
                      🏡 MP #{work.mp_id}
                    </span>
                  )}
                  {(work as any).agency_name && (
                    <span
                      className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-medium"
                      title="Implementing Agency (responsible for execution and payments)"
                    >
                      🏛️ {(work as any).agency_name}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium capitalize">
                    {work.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. STAT CARD ROW (Reference Images 3 & 4: 4 Accent Cards)
              ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Total Sanctioned */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 border-l-4 border-l-cyan-500 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sanctioned
                </span>
                <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-md">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-1 truncate">
                {formatCurrency(work.sanctioned_amt)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Approved budget</div>
            </div>

            {/* Card 2: Fund Utilization */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Utilization
                </span>
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base font-extrabold text-emerald-600 mt-1">
                {utilizationPct}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Exp: {formatCurrency(work.expenditure)}
              </div>
            </div>

            {/* Card 3: Execution Status */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 border-l-4 border-l-amber-500 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Work Status
                </span>
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base font-extrabold text-slate-900 capitalize mt-1 truncate">
                {work.status}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Sanction: {work.sanction_date || 'N/A'}
              </div>
            </div>

            {/* Card 4: Timeline / Completion */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 border-l-4 border-l-purple-500 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Completion
                </span>
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-1 truncate">
                {work.actual_completion || work.expected_completion || 'In Progress'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Milestone record</div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              4. WARNING BANNER (Reference Images 3 & 4 Pattern)
              ───────────────────────────────────────────────────────────── */}
          {isFlagged ? (
            <div className={`p-4 rounded-xl border flex items-center justify-between shadow-2xs transition-all duration-200 ${
              band === 'red'
                ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                : 'bg-amber-50/90 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${band === 'red' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <div className="text-xs font-black tracking-wide uppercase">
                    {band === 'red' ? '🔴' : '⚠️'} Risk {score.toFixed(2)} — {flagSummaryText}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5 font-medium">
                    {band === 'red'
                      ? 'Ranked high priority for human auditor review — not a finding of wrongdoing.'
                      : 'Ranked for supervisory review — unusual pattern detected, not a finding of wrongdoing.'}
                  </div>
                </div>
              </div>
              <Info className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            </div>
          ) : band === 'insufficient_data' ? (
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 flex items-center gap-3 text-xs">
              <Info className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <span className="font-bold">ℹ️ Insufficient Tracking Records</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Missing expenditure or completion milestone entries for complete evaluation.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl text-emerald-950 flex items-center gap-3 text-xs shadow-2xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">✅ Risk {score.toFixed(2)} — Within Normal Baselines</span>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">Cost, duplicate similarity, and completion timeline conform to national standards.</p>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              5. TABS (Overview, Financials, Flags)
              ───────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
            {[
              { id: 'overview', label: 'Risk & Overview' },
              { id: 'financials', label: 'Financial Performance' },
              { id: 'flags', label: `Audit Flags (${technicalFlags.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`pb-3 font-medium transition-all duration-200 ease-in-out border-b-2 ${
                  activeTab === t.id
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: RISK & OVERVIEW (Gauge + Explainability Stacked Bar)
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Row: Speedometer Gauge + Anomaly Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left: Speedometer Gauge Arc (Reference Images 3 & 4) */}
                <div className="md:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Composite Risk Gauge
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">0–100 Scale</span>
                  </div>

                  {/* Pure SVG Speedometer Arc */}
                  <div className="relative flex flex-col items-center my-2">
                    <svg viewBox="0 0 300 170" className="w-64 h-36">
                      <defs>
                        {/* Red -> Amber -> Green multi-stop gradient for the arc */}
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />    {/* Green (Low) */}
                          <stop offset="50%" stopColor="#f59e0b" />   {/* Amber (Moderate) */}
                          <stop offset="100%" stopColor="#e11d48" />  {/* Red (High) */}
                        </linearGradient>
                      </defs>

                      {/* Background Track Arc */}
                      <path
                        d="M 30 145 A 110 110 0 0 1 270 145"
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth="20"
                        strokeLinecap="round"
                      />

                      {/* Colored Gradient Arc */}
                      <path
                        d="M 30 145 A 110 110 0 0 1 270 145"
                        fill="none"
                        stroke="url(#gaugeGrad)"
                        strokeWidth="18"
                        strokeLinecap="round"
                        strokeDasharray="377"
                        strokeDashoffset={Math.max(0, 377 - (377 * (score / 100)))}
                        className="transition-all duration-700 ease-out"
                      />

                      {/* Scale Tick Labels */}
                      <text x="25" y="165" fontSize="10" fill="#94a3b8" fontWeight="600">0%</text>
                      <text x="80" y="70" fontSize="10" fill="#94a3b8" fontWeight="600">30%</text>
                      <text x="142" y="38" fontSize="10" fill="#94a3b8" fontWeight="600">50%</text>
                      <text x="205" y="70" fontSize="10" fill="#94a3b8" fontWeight="600">70%</text>
                      <text x="255" y="165" fontSize="10" fill="#94a3b8" fontWeight="600">100%</text>

                      {/* Center Needle */}
                      <g transform="translate(150, 145)">
                        <g 
                          transform={`rotate(${needleAngle})`} 
                          className="transition-transform duration-700 ease-out origin-center"
                        >
                          <line
                            x1="0"
                            y1="0"
                            x2="92"
                            y2="0"
                            stroke="#0f172a"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                          <polygon points="90,-3.5 100,0 90,3.5" fill="#0f172a" />
                        </g>
                        {/* Pivot Center */}
                        <circle cx="0" cy="0" r="7" fill="#0f172a" />
                        <circle cx="0" cy="0" r="3" fill="#ffffff" />
                      </g>
                    </svg>

                    {/* Numeric Score */}
                    <div className="text-center -mt-2">
                      <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                        {score.toFixed(1)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                        Weighted Anomaly Score
                      </div>
                    </div>
                  </div>

                  {/* ─────────────────────────────────────────────────────────
                      EXPLAINABILITY PANEL (Directly Below Gauge)
                      Horizontal Stacked Bar: Cost (40%), Duplicate (30%), Delay (30%)
                      ───────────────────────────────────────────────────────── */}
                  <div className="w-full mt-4 pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Explainability Breakdown</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Sum: {totalContrib.toFixed(1)} pts
                      </span>
                    </div>

                    {/* Stacked Horizontal Contribution Bar */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      {totalContrib > 0 ? (
                        <>
                          <div 
                            style={{ width: `${(costContrib / totalContrib) * 100}%` }}
                            className="bg-blue-500 h-full transition-all duration-500" 
                            title={`Cost Overrun: +${costContrib.toFixed(1)} pts`}
                          />
                          <div 
                            style={{ width: `${(dupContrib / totalContrib) * 100}%` }}
                            className="bg-amber-500 h-full transition-all duration-500" 
                            title={`Duplicate / Batch: +${dupContrib.toFixed(1)} pts`}
                          />
                          <div 
                            style={{ width: `${(delayContrib / totalContrib) * 100}%` }}
                            className="bg-rose-500 h-full transition-all duration-500" 
                            title={`Timeline Delay: +${delayContrib.toFixed(1)} pts`}
                          />
                        </>
                      ) : (
                        <div className="bg-emerald-400 h-full w-full" title="All factors zero risk" />
                      )}
                    </div>

                    {/* 3 Labeled Sub-factor Pills with Raw Values */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-blue-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Cost (40%)
                        </div>
                        <div className="font-bold text-slate-800 text-xs mt-0.5">
                          {(costScore * 100).toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          +{costContrib.toFixed(1)} pts
                        </div>
                      </div>

                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Duplicate (30%)
                        </div>
                        <div className="font-bold text-slate-800 text-xs mt-0.5">
                          {(dupScore * 100).toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          +{dupContrib.toFixed(1)} pts
                        </div>
                      </div>

                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Delay (30%)
                        </div>
                        <div className="font-bold text-slate-800 text-xs mt-0.5">
                          {(delayScore * 100).toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          +{delayContrib.toFixed(1)} pts
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Anomaly Status Grid (Reference Image 3 & 4 Pattern) */}
                <div className="md:col-span-6 space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Detector Statuses
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Cost Status */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Cost Engine</span>
                        <div className="text-sm font-bold text-slate-800 mt-1">
                          {costScore > 0.5 ? 'Severe Overrun' : costScore > 0 ? 'Elevated' : 'Normal Baseline'}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">Weight: 40%</span>
                      </div>

                      {/* Duplicate Status */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-slate-400">SBERT Engine</span>
                        <div className="text-sm font-bold text-slate-800 mt-1">
                          {dupScore >= 0.9 ? 'High-Confidence Duplicate' : dupScore >= 0.6 ? 'Possible Batch Entry' : dupScore > 0 ? 'Template Match' : 'Unique Project'}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">Weight: 30%</span>
                      </div>

                      {/* Delay Status */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Kaplan-Meier</span>
                        <div className="text-sm font-bold text-slate-800 mt-1">
                          {delayScore > 0.5 ? 'Critical Stall' : delayScore > 0 ? 'Delayed' : 'On Schedule'}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">Weight: 30%</span>
                      </div>

                      {/* Rules Status */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Statutory Rules</span>
                        <div className="text-sm font-bold text-slate-800 mt-1">
                          {technicalFlags.some(f => f.source === 'rule') ? 'Rule Triggered' : 'Compliant'}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">Hard Override</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Executive Summary Card */}
                  {llmSummaryFlag && (
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-2xs">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider mb-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>AI Audit Executive Summary</span>
                      </div>
                      <p className="text-xs text-blue-950 leading-relaxed font-medium">
                        {llmSummaryFlag.reason_text}
                      </p>
                    </div>
                  )}

                  {/* Duplicate Pairs Section */}
                  {work.duplicate_pairs && work.duplicate_pairs.length > 0 && (
                    <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl shadow-2xs space-y-2">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                        <Copy className="w-4 h-4 text-amber-600" />
                        <span>Duplicate Work Pair Detected</span>
                      </div>
                      {work.duplicate_pairs.map((pair) => {
                        const otherId = pair.work_id_a === work.id ? pair.work_id_b : pair.work_id_a;
                        return (
                          <div 
                            key={pair.id} 
                            className="flex items-center justify-between p-2.5 bg-white border border-amber-200 rounded-xl text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900">Work #{otherId}</span>
                              <span className="text-amber-700 font-mono ml-2 font-semibold">
                                ({(pair.similarity_score * 100).toFixed(1)}% match)
                              </span>
                            </div>
                            {onSelectWork && (
                              <button
                                type="button"
                                onClick={() => onSelectWork(otherId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors duration-150 shadow-2xs"
                              >
                                <span>Inspect #{otherId}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Description Block */}
              {work.description && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-xs leading-relaxed space-y-1">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                    Official Work Description
                  </span>
                  <p className="text-slate-700 font-medium">{work.description}</p>
                </div>
              )}

              {/* Score arithmetic table — makes the composite score transparent */}
              {work.risk_scores && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block mb-3">
                    Score Arithmetic
                  </span>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                        <th className="px-3 py-2 text-left border border-slate-100">Detector</th>
                        <th className="px-3 py-2 text-right border border-slate-100">Severity (0–1)</th>
                        <th className="px-3 py-2 text-right border border-slate-100">× Weight</th>
                        <th className="px-3 py-2 text-right border border-slate-100">= Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700 border border-slate-100">Cost Outlier</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 border border-slate-100">{costScore.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400 border border-slate-100">40%</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-700 border border-slate-100">+{costContrib.toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700 border border-slate-100">Duplicate / Template</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 border border-slate-100">{dupScore.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400 border border-slate-100">30%</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-700 border border-slate-100">+{dupContrib.toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700 border border-slate-100">Delay / Aging</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 border border-slate-100">{delayScore.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400 border border-slate-100">30%</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-700 border border-slate-100">+{delayContrib.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-slate-900 text-white">
                        <td className="px-3 py-2 font-black border border-slate-700">Composite Score</td>
                        <td className="px-3 py-2 border border-slate-700" />
                        <td className="px-3 py-2 border border-slate-700" />
                        <td className="px-3 py-2 text-right font-black font-mono text-rose-300 border border-slate-700">{score.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-2 italic">
                    Unusual ≠ fraudulent. This score ranks the work for human auditor review only.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: FINANCIAL PERFORMANCE & PROJECT DELIVERY
              (Reference Images 3 & 4 Lower Tables)
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'financials' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Financial Performance Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight border-b border-slate-100 pb-3">
                  Financial Performance
                </h3>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Sanctioned Amount:</span>
                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(work.sanctioned_amt)}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Released Funds:</span>
                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(work.released_amt)}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Recorded Expenditure:</span>
                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(work.expenditure)}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Remaining Balance:</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      {remainingBalance !== null ? formatCurrency(remainingBalance) : 'N/A'}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between bg-slate-50/60 px-2 rounded-lg mt-1">
                    <span className="font-semibold text-slate-700">Fund Utilization Rate:</span>
                    <span className="font-extrabold text-blue-600 font-mono text-sm">{utilizationPct}%</span>
                  </div>
                </div>
              </div>

              {/* Project Delivery Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight border-b border-slate-100 pb-3">
                  Project Delivery
                </h3>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Work Status:</span>
                    <span className="font-bold capitalize text-slate-900">{work.status}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Sanction Date:</span>
                    <span className="font-medium text-slate-800">{work.sanction_date || 'N/A'}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Completion Milestone:</span>
                    <span className="font-medium text-slate-800">
                      {work.actual_completion || work.expected_completion || 'Ongoing Execution'}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Jurisdiction:</span>
                    <span className="font-medium text-slate-800">{work.district}, {work.state}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500">Implementing Agency:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[180px]">
                      {work.agency_id ? `Agency #${work.agency_id}` : 'District Authority'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: TECHNICAL AUDIT FLAGS
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'flags' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Active anomaly indicators detected by ML models and statutory rules</span>
                <span className="font-bold text-slate-800">{technicalFlags.length} flags total</span>
              </div>

              {technicalFlags.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  No anomaly flags triggered for this project.
                </div>
              ) : (
                <div className="space-y-3">
                  {technicalFlags.map((flag) => (
                    <div 
                      key={flag.id} 
                      className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-start gap-3 hover:border-slate-300 transition-colors duration-150"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                            {flag.source.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          {flag.reason_text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            6. DRAWER FOOTER
            ───────────────────────────────────────────────────────────── */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-400">SIH 26102 • MPLADS AI Anomaly Watch</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-all duration-150 ease-in-out shadow-xs"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
