import React from 'react';

interface RiskBadgeProps {
  band?: 'green' | 'amber' | 'red' | string | null;
  score?: number | null;
  showScore?: boolean;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  band,
  score,
  showScore = false,
  className = '',
}) => {
  const normalizedBand = band?.toLowerCase() || 'green';

  let bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
  let dotClass = 'bg-emerald-500';
  let label = 'Low Risk';

  if (normalizedBand === 'red') {
    bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
    dotClass = 'bg-rose-500 animate-pulse';
    label = 'High Priority';
  } else if (normalizedBand === 'amber') {
    bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
    dotClass = 'bg-amber-500';
    label = 'Needs Review';
  } else if (normalizedBand === 'insufficient_data') {
    bgClass = 'bg-slate-100 text-slate-600 border-slate-200';
    dotClass = 'bg-slate-400';
    label = 'Insufficient Data';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors duration-150 ${bgClass} ${className}`}
      title={score !== null && score !== undefined ? `Risk Score: ${score.toFixed(1)}/100` : label}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span className="truncate">{label}</span>
      {showScore && score !== null && score !== undefined && (
        <span className="font-mono text-[11px] opacity-85 font-bold ml-0.5">
          {score.toFixed(1)}
        </span>
      )}
    </span>
  );
};
