import React from 'react';
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Radio,
  ExternalLink,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { ClientCompanyProfile, DashboardTab } from '../../types';

interface SidebarProps {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  clientProfile: ClientCompanyProfile;
  bookingCount: number;
  newBookingCount: number;
  inquiryCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  clientProfile,
  bookingCount,
  newBookingCount,
  inquiryCount,
}) => {
  const navItems: {
    id: DashboardTab;
    label: string;
    icon: React.ElementType;
    badge: string;
    badgeColor: string;
    description: string;
  }[] = [
    {
      id: 'orders',
      label: 'Freight Orders Desk',
      icon: Package,
      badge: newBookingCount > 0 ? `${newBookingCount} New` : `${bookingCount}`,
      badgeColor:
        newBookingCount > 0
          ? 'bg-blue-600 text-white font-bold'
          : 'bg-slate-100 text-slate-600 border border-slate-200',
      description: 'Incoming customer load demands',
    },
    {
      id: 'overview',
      label: 'Executive Overview',
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'bg-blue-50 text-blue-700 border border-blue-200',
      description: 'Daily KPIs, volume & routes',
    },
    {
      id: 'inquiries',
      label: 'Live Inquiries & Help',
      icon: MessageSquare,
      badge: inquiryCount > 0 ? `${inquiryCount} Active` : '',
      badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      description: 'In-progress chats & support',
    },
  ];

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0">
      {/* App Branding */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                TRAKET
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Live
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">WhatsApp Dispatch Desk</div>
          </div>
        </div>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-150 group text-left ${
                isActive
                  ? 'bg-blue-50 border border-blue-200/80 text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-xs font-semibold ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                    {item.label}
                  </div>
                  <div className={`text-[10px] line-clamp-1 ${isActive ? 'text-blue-700/80' : 'text-slate-500'}`}>
                    {item.description}
                  </div>
                </div>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* WhatsApp Bot Status Card */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
              <span className="text-xs font-bold text-slate-800">Bot Online</span>
            </div>
            <span className="text-[10px] text-blue-600 font-semibold">Synced</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center space-x-1">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{clientProfile.phoneNumber}</span>
            </span>
            <a
              href={`https://wa.me/${clientProfile.phoneNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 flex items-center space-x-0.5 text-[10px] font-semibold"
            >
              <span>Test</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        <div className="mt-3 text-center text-[10px] text-slate-500 flex items-center justify-center space-x-1">
          <ShieldCheck className="w-3 h-3 text-blue-600" />
          <span>Traket Logistics Portal v2.0</span>
        </div>
      </div>
    </aside>
  );
};
