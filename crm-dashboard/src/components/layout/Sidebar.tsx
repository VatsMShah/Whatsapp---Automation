import React from 'react';
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Radio,
  Menu,
  Users,
  ShieldCheck,
  UserCircle,
  Archive,
  LogOut,
} from 'lucide-react';
import { ClientCompanyProfile, DashboardTab } from '../../types';
import { UserRole } from '../../context/RoleContext';

interface SidebarProps {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  clientProfile: ClientCompanyProfile;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  role: UserRole;
  employeeName?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  clientProfile,
  isCollapsed,
  onToggleCollapse,
  role,
  employeeName,
  onLogout,
}) => {
  const isAdmin = role === 'admin';

  const navItems: {
    id: DashboardTab;
    label: string;
    icon: React.ElementType;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'orders',
      label: isAdmin ? 'Freight Orders Desk' : 'My Leads',
      icon: Package,
    },
    {
      id: 'overview',
      label: 'Executive Overview',
      icon: LayoutDashboard,
      adminOnly: true,
    },
    {
      id: 'inquiries',
      label: 'Live Inquiries & Help',
      icon: MessageSquare,
    },
    {
      id: 'team',
      label: 'Team Management',
      icon: Users,
      adminOnly: true,
    },
    {
      id: 'archive',
      label: 'Archive & Statements',
      icon: Archive,
      adminOnly: true,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className={`bg-white border-r border-slate-200/80 flex flex-col h-screen select-none shrink-0 transition-all duration-200 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* App Branding */}
      <div className="p-3.5 border-b border-slate-100 flex items-center min-h-[64px]">
        {!isCollapsed ? (
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm tracking-tight text-slate-900 truncate flex items-center gap-1.5">
                TRAKET
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                Logistics Dispatch Hub
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <Radio className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Role Banner */}
      {!isCollapsed && (
        <div
          className={`mx-2.5 mt-2.5 px-3 py-2 rounded-xl flex items-center justify-between border ${
            isAdmin
              ? 'bg-slate-50 border-slate-200/60'
              : 'bg-violet-50/70 border-violet-200/60'
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isAdmin ? 'bg-blue-600' : 'bg-violet-600'}`}></div>
            <div className="min-w-0">
              <div
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isAdmin ? 'text-slate-700' : 'text-violet-700'
                }`}
              >
                {isAdmin ? 'Admin View' : 'Employee View'}
              </div>
              {!isAdmin && employeeName && (
                <div className="text-[10px] text-violet-600 font-semibold truncate">
                  {employeeName}
                </div>
              )}
            </div>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
            {isAdmin ? 'HQ Access' : 'Specialist'}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isAdmin ? 'Operations' : 'My Workspace'}
          </div>
        )}

        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl transition-all duration-150 group text-left cursor-pointer ${
                isCollapsed
                  ? 'justify-center p-2.5'
                  : 'px-3 py-2.5 space-x-3'
              } ${
                isActive
                  ? 'bg-blue-50/90 border border-blue-200/80 text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <span
                  className={`text-xs font-semibold truncate flex-1 ${
                    isActive ? 'text-blue-900' : 'text-slate-700'
                  }`}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Footer: Logout & Collapse */}
      <div className="p-2.5 border-t border-slate-100 space-y-1 bg-white">
        {onLogout && (
          <button
            onClick={onLogout}
            title={isCollapsed ? 'Log Out' : undefined}
            className={`w-full p-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition flex items-center cursor-pointer ${
              isCollapsed ? 'justify-center' : 'space-x-2.5 px-3'
            }`}
          >
            <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
            {!isCollapsed && <span className="text-xs font-bold text-rose-600">Log Out</span>}
          </button>
        )}

        <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition flex items-center cursor-pointer ${
              isCollapsed ? 'justify-center w-full' : 'space-x-2 px-3 w-full'
            }`}
          >
            <Menu className="w-4 h-4 text-slate-600 shrink-0" />
            {!isCollapsed && (
              <span className="text-xs text-slate-600 font-medium">Collapse</span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
