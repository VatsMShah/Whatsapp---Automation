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
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
          : 'bg-slate-800 text-slate-300 border border-slate-700/60',
      description: 'Incoming customer load demands',
    },
    {
      id: 'overview',
      label: 'Executive Overview',
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      description: 'Daily KPIs, volume & routes',
    },
    {
      id: 'inquiries',
      label: 'Live Inquiries & Help',
      icon: MessageSquare,
      badge: inquiryCount > 0 ? `${inquiryCount} Active` : '',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      description: 'In-progress chats & support',
    },
  ];

  return (
    <aside className="w-72 bg-[#0b101d] border-r border-slate-800/80 flex flex-col h-screen select-none shrink-0">
      {/* App Branding */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">
                TRAKET
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live
              </span>
            </div>
            <div className="text-xs text-slate-400 font-medium">WhatsApp Dispatch Desk</div>
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
                  ? 'bg-gradient-to-r from-emerald-600/20 via-slate-800/60 to-slate-800/40 border border-emerald-500/40 text-white shadow-lg shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                      : 'bg-slate-800/80 text-slate-400 group-hover:text-white group-hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1">{item.description}</div>
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
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-3.5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-white">Bot Online</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">Synced</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{clientProfile.phoneNumber}</span>
            </span>
            <a
              href={`https://wa.me/${clientProfile.phoneNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-0.5 text-[10px] font-semibold"
            >
              <span>Test</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        <div className="mt-3 text-center text-[10px] text-slate-400 flex items-center justify-center space-x-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Traket Logistics Portal v2.0</span>
        </div>
      </div>
    </aside>
  );
};
