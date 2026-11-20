import React, { useState } from 'react';
import { Search, RefreshCw, Download, ShieldCheck, UserCheck, ChevronDown, UserCircle, LogOut, Bell, KeyRound } from 'lucide-react';
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
  // Notifications
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  // Role switcher
  authRole: UserRole | null;
  role: UserRole;
  currentEmployee: Employee | null;
  employees: Employee[];
  onSwitchToAdmin: () => void;
  onSwitchToEmployee: (emp: Employee) => void;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
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
  unreadNotificationsCount = 0,
  onOpenNotifications,
  authRole,
  role,
  currentEmployee,
  employees,
  onSwitchToAdmin,
  onSwitchToEmployee,
  onOpenChangePassword,
  onLogout,
}) => {
  const isAdmin = role === 'admin';
  const canSwitchRoles = authRole === 'admin';
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  return (
    <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Title & Badge */}
      <div className="min-w-0">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            {clientProfile.name}
          </span>
        </div>
        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{subtitle}</p>
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
            className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl pl-9 pr-12 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
          />
          <span className="hidden lg:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
            ⌘K
          </span>
        </div>

        {/* Sync Live Button */}
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            title="Fetch fresh data from Supabase"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-2xs hover:border-slate-300 transition text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {/* Export CSV Button (Admin: All Orders | Employee: My Leads Only) */}
        {onExportCsv && (
          <button
            onClick={onExportCsv}
            title={isAdmin ? "Export all orders as CSV" : "Export your assigned leads as CSV"}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-2xs hover:border-slate-300 transition text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>{isAdmin ? 'Export CSV' : 'Export My Leads'}</span>
          </button>
        )}

        {/* Lead Notification Bell */}
        {onOpenNotifications && (
          <button
            onClick={onOpenNotifications}
            title={`${unreadNotificationsCount} Pending Lead Notifications`}
            className="relative p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-2xs hover:border-slate-300 transition cursor-pointer"
          >
            <Bell className={`w-4 h-4 ${unreadNotificationsCount > 0 ? 'text-blue-600' : 'text-slate-500'}`} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        )}

        {/* Role Switcher */}
        <div className="pl-3 border-l border-slate-200 relative">
          <button
            onClick={() => setShowRoleMenu((v) => !v)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition text-xs font-semibold cursor-pointer shadow-2xs ${
              isAdmin
                ? 'bg-blue-50/80 border-blue-200/80 text-blue-900 hover:bg-blue-100/80'
                : 'bg-violet-50/80 border-violet-200/80 text-violet-900 hover:bg-violet-100/80'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[11px] shadow-xs ${isAdmin ? 'bg-blue-600' : 'bg-violet-600'}`}>
              {isAdmin ? (
                'A'
              ) : (
                (currentEmployee?.name?.slice(0, 1) || 'E').toUpperCase()
              )}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-[10px] font-extrabold uppercase tracking-wide leading-none">
                {isAdmin ? 'Admin' : currentEmployee?.name || 'Employee'}
              </div>
              <div className={`text-[9px] font-medium leading-none mt-0.5 ${isAdmin ? 'text-blue-600' : 'text-violet-600'}`}>
                {isAdmin ? 'Full Access' : currentEmployee?.employee_id || ''}
              </div>
            </div>
            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          {/* Dropdown Menu */}
          {showRoleMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {canSwitchRoles ? (
                <>
                  {/* Admin Option (Only visible to JWT-verified Admins) */}
                  <button
                    onClick={() => { onSwitchToAdmin(); setShowRoleMenu(false); }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-slate-50 transition cursor-pointer ${isAdmin ? 'bg-blue-50/70' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                      <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Admin View</div>
                      <div className="text-[10px] text-slate-500 font-medium">Full access to all leads & team</div>
                    </div>
                    {isAdmin && <div className="ml-auto w-2 h-2 rounded-full bg-blue-600" />}
                  </button>

                  <div className="px-4 py-1.5 border-t border-slate-100 bg-slate-50/50">
                    <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Preview Employee View</div>
                  </div>

                  {/* Employee Options */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/60">
                    {employees.filter((e) => e.is_active).map((emp) => (
                      <button
                        key={emp.employee_id}
                        onClick={() => { onSwitchToEmployee(emp); setShowRoleMenu(false); }}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 text-left hover:bg-slate-50 transition cursor-pointer ${
                          !isAdmin && currentEmployee?.employee_id === emp.employee_id ? 'bg-violet-50/70' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0 shadow-2xs">
                          {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">{emp.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{emp.employee_id} · {emp.department}</div>
                        </div>
                        {!isAdmin && currentEmployee?.employee_id === emp.employee_id && (
                          <div className="ml-auto w-2 h-2 rounded-full bg-violet-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {employees.filter((e) => e.is_active).length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400 text-center">
                      No employees added yet
                    </div>
                  )}
                </>
              ) : (
                <div className="px-4 py-3 bg-violet-50/60 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {currentEmployee?.name || 'Employee'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {currentEmployee?.employee_id || ''}{currentEmployee?.department ? ` · ${currentEmployee.department}` : ''}
                  </div>
                  <div className="text-[10px] font-semibold text-violet-700 mt-1">
                    Signed in as Specialist
                  </div>
                </div>
              )}

              {/* Account Actions */}
              <div className="p-1.5 border-t border-slate-100 bg-slate-50/60 space-y-1">
                {onOpenChangePassword && (
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      onOpenChangePassword();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 hover:bg-white hover:shadow-2xs rounded-xl transition text-xs font-semibold cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    <span>Change Password</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition text-xs font-bold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out from CRM</span>
                  </button>
                )}
              </div>
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
