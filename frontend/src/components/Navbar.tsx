import React from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthSession, getStoredRole, getStoredScope } from '../api/client';
import { ShieldAlert, LogOut, User, Building } from 'lucide-react';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const role = getStoredRole();
  const scope = getStoredScope();

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const getScopeDescription = () => {
    if (role === 'ministry') return 'National Jurisdiction (All States & Districts)';
    if (role === 'state') return `State Jurisdiction: ${scope.state || 'Assigned State'}`;
    if (role === 'district') return `District Jurisdiction: ${scope.district || 'Assigned District'}, ${scope.state || ''}`;
    if (role === 'mp') return `Constituency Workload (MP ID #${scope.mp_id})`;
    return 'MPLADS Jurisdiction';
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">DrishtiX</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {role || 'Public'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AI-Powered MPLADS Fraud & Anomaly Detection
            </p>
          </div>
        </div>

        {/* Scope info, nav links & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <Building className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300 font-medium">{getScopeDescription()}</span>
          </div>

          {/* Quick nav links */}
          <div className="hidden sm:flex items-center gap-1">
            <a
              href="/coverage"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-150"
              title="Coverage & Data Quality"
            >
              Coverage
            </a>
            <a
              href="/methodology"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-150"
              title="Methodology & Limitations"
            >
              Methodology
            </a>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
