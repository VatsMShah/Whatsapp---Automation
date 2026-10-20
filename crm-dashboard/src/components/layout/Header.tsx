import React from 'react';
import { Search, RefreshCw, Download, ShieldCheck, UserCheck } from 'lucide-react';
import { ClientCompanyProfile } from '../../types';

interface HeaderProps {
  title: string;
  subtitle: string;
  clientProfile: ClientCompanyProfile;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  onExportCsv?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  clientProfile,
  searchQuery,
  onSearchChange,
  onRefreshData,
  isRefreshing,
  onExportCsv,
}) => {
  return (
    <header className="h-16 bg-[#0c1222]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Title & Badge */}
      <div className="min-w-0">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
            {title}
          </h1>
          <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            {clientProfile.name}
          </span>
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
      </div>

      {/* Global Actions */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* Search */}
        <div className="relative w-48 lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search city, PIN, company, phone..."
            className="w-full bg-slate-900/90 border border-slate-700/60 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Sync Live Button */}
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            title="Fetch fresh data from Supabase"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition text-xs font-medium disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {/* Export CSV Button */}
        {onExportCsv && (
          <button
            onClick={onExportCsv}
            title="Export orders as CSV"
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        )}

        {/* Client Admin Badge */}
        <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-800/80">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-white flex items-center space-x-1">
              <span>Dispatcher Desk</span>
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-[10px] text-slate-400">Admin Live</div>
          </div>
        </div>
      </div>
    </header>
  );
};
