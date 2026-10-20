import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { BookingsTable } from './components/tables/BookingsTable';
import { InquiriesDesk } from './components/inquiries/InquiriesDesk';
import { dbService, ACTIVE_CLIENT_PROFILE } from './services/supabase';
import {
  FreightBooking,
  SessionRecord,
  SupportTicket,
  ClientCompanyProfile,
  DashboardTab,
} from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<DashboardTab>('orders');
  const [clientProfile] = useState<ClientCompanyProfile>(ACTIVE_CLIENT_PROFILE);

  // Core Data State
  const [bookings, setBookings] = useState<FreightBooking[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real data from Supabase
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [b, s, t] = await Promise.all([
        dbService.getBookings(),
        dbService.getSessions(),
        dbService.getSupportTickets(),
      ]);
      setBookings(b || []);
      setSessions(s || []);
      setSupportTickets(t || []);
    } catch (err) {
      console.error('Failed to load Supabase data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Live polling every 20s to capture incoming WhatsApp interactions
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateBookingStatus = async (
    userId: string,
    status: FreightBooking['status'],
    remarks?: string
  ) => {
    await dbService.updateBookingStatus(userId, status, remarks);
    setBookings((prev) =>
      prev.map((b) =>
        b.user_id === userId
          ? { ...b, status, ...(remarks !== undefined ? { remarks } : {}) }
          : b
      )
    );
  };

  const handleUpdateSupportStatus = async (
    userId: string,
    status: SupportTicket['status']
  ) => {
    await dbService.updateSupportStatus(userId, status);
    setSupportTickets((prev) =>
      prev.map((t) => (t.user_id === userId ? { ...t, status } : t))
    );
  };

  const handleExportCsv = () => {
    if (bookings.length === 0) return;

    const headers = [
      'Date',
      'Status',
      'Origin',
      'Destination',
      'Cargo Type',
      'Vehicle / Container',
      'Weight',
      'Loading Date',
      'Time Slot',
      'Contact Person',
      'Primary Phone',
      'Alternate Phone',
      'Company Name',
      'Remarks',
    ];

    const rows = bookings.map((b) => [
      `"${new Date(b.updated_at).toLocaleDateString()}"`,
      `"${b.status}"`,
      `"${b.originCity || b.origin}"`,
      `"${b.destinationCity || b.destination}"`,
      `"${b.cargo_type}"`,
      `"${b.vehicle_or_container}"`,
      `"${b.weight}"`,
      `"${b.loading_date}"`,
      `"${b.time_slot}"`,
      `"${b.contact_name}"`,
      `"${b.phone}"`,
      `"${b.alternate_phone || ''}"`,
      `"${b.company_name}"`,
      `"${(b.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Traket_Freight_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTabHeader = () => {
    switch (currentTab) {
      case 'orders':
        return {
          title: 'Freight Orders Desk',
          subtitle: 'Live customer cargo demands with 1-click WhatsApp quote dispatch',
        };
      case 'overview':
        return {
          title: 'Executive Metrics & Overview',
          subtitle: 'Operational summary of demand volume, top lanes, and order pipeline',
        };
      case 'inquiries':
        return {
          title: 'Live Inquiries & Support Desk',
          subtitle: 'Direct customer help tickets and active in-progress bot conversation sessions',
        };
      default:
        return {
          title: 'Traket Logistics Desk',
          subtitle: 'WhatsApp Automation Dispatch Hub',
        };
    }
  };

  const { title, subtitle } = getTabHeader();
  const newBookingCount = bookings.filter((b) => b.status === 'new').length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        clientProfile={clientProfile}
        bookingCount={bookings.length}
        newBookingCount={newBookingCount}
        inquiryCount={supportTickets.length + sessions.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          title={title}
          subtitle={subtitle}
          clientProfile={clientProfile}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefreshData={loadData}
          isRefreshing={isRefreshing}
          onExportCsv={handleExportCsv}
        />

        {/* Dynamic Views */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentTab === 'orders' && (
            <BookingsTable
              bookings={bookings}
              searchQuery={searchQuery}
              onUpdateStatus={handleUpdateBookingStatus}
            />
          )}

          {currentTab === 'overview' && (
            <DashboardOverview
              bookings={bookings}
              clientProfile={clientProfile}
              inquiryCount={supportTickets.length + sessions.length}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'inquiries' && (
            <InquiriesDesk
              sessions={sessions}
              supportTickets={supportTickets}
              onUpdateSupportStatus={handleUpdateSupportStatus}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
