import React from 'react';
import { Search, RefreshCw, Download, ShieldCheck, UserCheck, Menu } from 'lucide-react';
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
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Title & Badge */}
      <div className="min-w-0">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
          <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700">
            {clientProfile.name}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
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
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
        </div>

        {/* Sync Live Button */}
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            title="Fetch fresh data from Supabase"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs transition text-xs font-medium disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {/* Export CSV Button */}
        {onExportCsv && (
          <button
            onClick={onExportCsv}
            title="Export orders as CSV"
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs transition text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>
        )}

        {/* Client Admin Badge */}
        <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
              <span>Dispatcher Desk</span>
              <ShieldCheck className="w-3 h-3 text-blue-600" />
            </div>
            <div className="text-[10px] text-slate-500">Admin Live</div>
          </div>
        </div>
      </div>
    </header>
  );
};
