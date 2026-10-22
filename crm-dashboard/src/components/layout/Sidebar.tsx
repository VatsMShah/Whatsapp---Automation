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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  clientProfile,
  isCollapsed,
  onToggleCollapse,
  role,
  employeeName,
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
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0 transition-all duration-200 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* App Branding */}
      <div className="p-3.5 border-b border-slate-200 flex items-center min-h-[64px]">
        {!isCollapsed ? (
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm tracking-tight text-slate-900 truncate">
                TRAKET
              </div>
              <div className="text-[10px] text-slate-500 font-medium truncate">
                Logistics Dispatch Hub
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Radio className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Role Banner */}
      {!isCollapsed && (
        <div
          className={`mx-2.5 mt-2.5 px-3 py-2 rounded-xl flex items-center space-x-2 ${
            isAdmin
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-violet-50 border border-violet-200'
          }`}
        >
          {isAdmin ? (
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          ) : (
            <UserCircle className="w-4 h-4 text-violet-600 shrink-0" />
          )}
          <div className="min-w-0">
            <div
              className={`text-[10px] font-extrabold uppercase tracking-wider ${
                isAdmin ? 'text-blue-700' : 'text-violet-700'
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
      )}

      {/* Navigation */}
      <div className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
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
              className={`w-full flex items-center rounded-xl transition-all duration-150 group text-left ${
                isCollapsed
                  ? 'justify-center p-2.5'
                  : 'px-3 py-2.5 space-x-3'
              } ${
                isActive
                  ? 'bg-blue-50 border border-blue-200/80 text-blue-900 shadow-xs'
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
                  className={`text-xs font-semibold truncate ${
                    isActive ? 'text-blue-900' : 'text-slate-800'
                  }`}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse Button */}
      <div className={`p-2.5 border-t border-slate-200 flex ${isCollapsed ? 'justify-center' : 'justify-start px-3'}`}>
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition flex items-center space-x-2"
        >
          <Menu className="w-4 h-4 text-slate-600" />
          {!isCollapsed && (
            <span className="text-xs text-slate-600 font-medium">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  );
};
