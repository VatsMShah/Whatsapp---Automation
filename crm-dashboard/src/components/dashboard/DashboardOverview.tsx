import React from 'react';
import {
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
  PhoneCall,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { FreightBooking, ClientCompanyProfile, DashboardTab } from '../../types';

interface DashboardOverviewProps {
  bookings: FreightBooking[];
  clientProfile: ClientCompanyProfile;
  inquiryCount: number;
  onNavigateTab: (tab: DashboardTab) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  bookings,
  clientProfile,
  inquiryCount,
  onNavigateTab,
}) => {
  const totalLeads = bookings.length;
  const newLeads = bookings.filter((b) => b.status === 'new').length;
  const quotedLeads = bookings.filter((b) => b.status === 'quoted').length;
  const closedLeads = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length;

  // Compute top routes
  const routeCounts: Record<string, number> = {};
  bookings.forEach((b) => {
    const orig = b.originCity || b.origin || 'Origin';
    const dest = b.destinationCity || b.destination || 'Dest';
    const key = `${orig} ➔ ${dest}`;
    routeCounts[key] = (routeCounts[key] || 0) + 1;
  });

  const sortedRoutes = Object.entries(routeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // 5 newest orders
  const recentBookings = bookings.slice(0, 5);

  const statCards = [
    {
      title: 'Total Inbound Demands',
      value: totalLeads,
      subtitle: totalLeads > 0 ? 'Direct from WhatsApp Bot' : 'Waiting for leads',
      icon: Package,
      iconBg: 'bg-blue-600 text-white',
      badge: 'All Time',
    },
    {
      title: 'Action Needed (New Leads)',
      value: newLeads,
      subtitle: newLeads > 0 ? 'Pending quote dispatch' : 'All caught up!',
      icon: Clock,
      iconBg: 'bg-amber-500 text-white',
      badge: newLeads > 0 ? 'High Priority' : 'Zero Backlog',
      highlight: newLeads > 0,
    },
    {
      title: 'Quotes Sent / Active',
      value: quotedLeads,
      subtitle: 'Awaiting customer confirmation',
      icon: TrendingUp,
      iconBg: 'bg-indigo-600 text-white',
      badge: 'In Pipeline',
    },
    {
      title: 'Confirmed & Closed',
      value: closedLeads,
      subtitle: 'Trucks assigned / Delivered',
      icon: CheckCircle2,
      iconBg: 'bg-slate-700 text-white',
      badge: 'Deals Closed',
    },
  ];

  const getCleanPhone = (phone?: string) => {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
              Live Logistics Operations Desk
            </span>
            <span className="text-xs text-slate-500">Connected to Supabase PostgreSQL</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1.5">
            Welcome to {clientProfile.name} Dispatch Portal
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            Realtime customer freight demands, cargo specifications, and WhatsApp conversation streams are synced instantly.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigateTab('orders')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition active:scale-95"
          >
            <span>Open Orders Desk</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-xl bg-white border transition-all duration-200 relative overflow-hidden shadow-sm ${
                card.highlight
                  ? 'border-amber-300 ring-1 ring-amber-300/50'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{card.title}</span>
                <div
                  className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center shadow-xs`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {card.value}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {card.badge}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mt-1.5">{card.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Two Column Section: Recent Demands & Top Routes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent 5 Inbound Demands (Takes 2 cols) */}
        <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>Recent Inbound Demands</span>
                {newLeads > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {newLeads} Action Needed
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                New freight inquiries submitted via the WhatsApp bot
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentBookings.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No inquiries recorded yet. When a customer uses the WhatsApp bot, their load request will show here.
              </div>
            ) : (
              recentBookings.map((b) => {
                const phone = getCleanPhone(b.phone);
                const waText = encodeURIComponent(
                  `Hello ${b.contact_name || ''}! We received your load requirement for ${b.vehicle_or_container || 'truck'} from ${b.origin} to ${b.destination}. Here is our quote:`
                );
                return (
                  <div
                    key={b.user_id}
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100/60 transition flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {b.originCity || b.origin} ➔ {b.destinationCity || b.destination}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0 font-medium">
                          {b.cargo_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center space-x-2">
                        <span className="font-semibold text-slate-800">{b.vehicle_or_container || 'Vehicle'}</span>
                        {b.weight && <span className="text-amber-700 font-mono font-semibold">• {b.weight}</span>}
                        <span className="text-slate-500">• Contact: {b.contact_name || b.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <a
                        href={`https://wa.me/${phone}?text=${waText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center space-x-1 shadow-xs transition"
                      >
                        <span>WhatsApp</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Top Freight Corridors (Takes 1 col) */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Top Freight Corridors</h3>
            <p className="text-xs text-slate-500 mt-0.5">Most active lanes requested on bot</p>
          </div>

          <div className="space-y-3">
            {sortedRoutes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Not enough route data yet.
              </div>
            ) : (
              sortedRoutes.map(([route, count], index) => (
                <div
                  key={route}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{route}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {count} {count === 1 ? 'Trip' : 'Trips'}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Inquiries Desk:</span>
            <button
              onClick={() => onNavigateTab('inquiries')}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1"
            >
              <span>{inquiryCount} Inquiries</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
