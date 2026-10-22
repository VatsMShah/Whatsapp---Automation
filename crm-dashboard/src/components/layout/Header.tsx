import React, { useState } from 'react';
import { Search, RefreshCw, Download, ShieldCheck, UserCheck, ChevronDown, UserCircle, LogOut } from 'lucide-react';
import { ClientCompanyProfile, Employee } from '../../types';
import { UserRole } from '../../context/RoleContext';

interface HeaderProps {
  title: string;
  subtitle: string;
  clientProfile: ClientCompanyProfile;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  onExportCsv?: () => void;
  // Role switcher
  role: UserRole;
  currentEmployee: Employee | null;
  employees: Employee[];
  onSwitchToAdmin: () => void;
  onSwitchToEmployee: (emp: Employee) => void;
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
  role,
  currentEmployee,
  employees,
  onSwitchToAdmin,
  onSwitchToEmployee,
}) => {
  const isAdmin = role === 'admin';
  const [showRoleMenu, setShowRoleMenu] = useState(false);

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

        {/* Export CSV Button (admin only) */}
        {onExportCsv && isAdmin && (
          <button
            onClick={onExportCsv}
            title="Export orders as CSV"
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs transition text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>
        )}

        {/* Role Switcher */}
        <div className="pl-3 border-l border-slate-200 relative">
          <button
            onClick={() => setShowRoleMenu((v) => !v)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border transition text-xs font-semibold ${
              isAdmin
                ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                : 'bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isAdmin ? 'bg-blue-600' : 'bg-violet-600'}`}>
              {isAdmin ? (
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              ) : (
                <UserCircle className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-[10px] font-extrabold uppercase tracking-wide">
                {isAdmin ? 'Admin' : currentEmployee?.name || 'Employee'}
              </div>
              <div className={`text-[9px] font-medium ${isAdmin ? 'text-blue-500' : 'text-violet-500'}`}>
                {isAdmin ? 'Full Access' : currentEmployee?.employee_id || ''}
              </div>
            </div>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Dropdown Menu */}
          {showRoleMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              {/* Admin Option */}
              <button
                onClick={() => { onSwitchToAdmin(); setShowRoleMenu(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 transition ${isAdmin ? 'bg-blue-50' : ''}`}
              >
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Admin View</div>
                  <div className="text-[10px] text-slate-500">Full access to all leads & team</div>
                </div>
                {isAdmin && <div className="ml-auto w-2 h-2 rounded-full bg-blue-600" />}
              </button>

              <div className="px-4 py-1.5 border-t border-slate-100">
                <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Switch to Employee</div>
              </div>

              {/* Employee Options */}
              {employees.filter((e) => e.is_active).map((emp) => (
                <button
                  key={emp.employee_id}
                  onClick={() => { onSwitchToEmployee(emp); setShowRoleMenu(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-left hover:bg-slate-50 transition ${
                    !isAdmin && currentEmployee?.employee_id === emp.employee_id ? 'bg-violet-50' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                    {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{emp.name}</div>
                    <div className="text-[10px] text-slate-500">{emp.employee_id} · {emp.department}</div>
                  </div>
                  {!isAdmin && currentEmployee?.employee_id === emp.employee_id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-violet-600" />
                  )}
                </button>
              ))}

              {employees.filter((e) => e.is_active).length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">
                  No employees added yet
                </div>
              )}
            </div>
          )}

          {/* Click outside to close */}
          {showRoleMenu && (
            <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
          )}
        </div>
      </div>
    </header>
  );
};
