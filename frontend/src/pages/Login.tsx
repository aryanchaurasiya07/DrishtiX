import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, setAuthSession } from '../api/client';
import { LoginResponse } from '../api/types';
import { ShieldAlert, ArrowRight, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (u = username, p = password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<LoginResponse>('/auth/login', {
        username: u,
        password: p,
      });
      setAuthSession(res.data);
      navigate(`/${res.data.role}`);
    } catch (err: any) {
      if (!err.response) {
        setError('Network error: Cannot reach the server. Is it running?');
      } else if (err.response.status >= 500) {
        setError(`Server error (${err.response.status}): The database might be offline or unreachable.`);
      } else {
        setError(err.response.data?.detail || 'Invalid login credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  const handleDemoLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    handleLogin(u, p);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle ambient gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-2xl font-black tracking-tight text-slate-900">
          ArthDrishti AI
        </h2>
        <p className="mt-1.5 text-center text-xs text-slate-500 font-medium">
          AI-Powered MPLADS Fraud & Anomaly Detection • SIH 26102
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Ministry of Statistics and Programme Implementation
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-white py-8 px-6 shadow-xl border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer mt-3"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
              One-Click Demo Personas
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => handleDemoLogin('ministry_user', 'ministry123')}
                className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all duration-200 group cursor-pointer hover:shadow-2xs"
              >
                <div className="font-bold text-slate-900 group-hover:text-blue-600 text-[11px] transition-colors duration-150">Ministry User</div>
                <div className="text-[10px] text-slate-500 mt-0.5">National Oversight</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('state_user', 'state123')}
                className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all duration-200 group cursor-pointer hover:shadow-2xs"
              >
                <div className="font-bold text-slate-900 group-hover:text-blue-600 text-[11px] transition-colors duration-150">State User</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Madhya Pradesh</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('district_user', 'district123')}
                className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all duration-200 group cursor-pointer hover:shadow-2xs"
              >
                <div className="font-bold text-slate-900 group-hover:text-blue-600 text-[11px] transition-colors duration-150">District User</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Bhopal Collector</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('mp_user', 'mp123')}
                className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all duration-200 group cursor-pointer hover:shadow-2xs"
              >
                <div className="font-bold text-slate-900 group-hover:text-blue-600 text-[11px] transition-colors duration-150">MP User</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Constituency MP #1</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
