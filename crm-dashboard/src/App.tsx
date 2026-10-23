import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { BookingsTable } from './components/tables/BookingsTable';
import { InquiriesDesk } from './components/inquiries/InquiriesDesk';
import { TeamManager } from './components/team/TeamManager';
import { RoleProvider, useRole } from './context/RoleContext';
import { dbService, ACTIVE_CLIENT_PROFILE } from './services/supabase';
import {
  FreightBooking,
  SessionRecord,
  SupportTicket,
  ClientCompanyProfile,
  DashboardTab,
  Employee,
  LeadAssignment,
} from './types';

// Inner app that has access to RoleContext
function AppInner() {
  const { role, currentEmployee, switchToAdmin, switchToEmployee } = useRole();
  const isAdmin = role === 'admin';

  const [currentTab, setCurrentTab] = useState<DashboardTab>('orders');
  const [clientProfile] = useState<ClientCompanyProfile>(ACTIVE_CLIENT_PROFILE);

  // Core Data State
  const [bookings, setBookings] = useState<FreightBooking[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Record<string, LeadAssignment>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Fetch real data from Supabase
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [b, s, t, emps] = await Promise.all([
        dbService.getBookings(),
        dbService.getSessions(),
        dbService.getSupportTickets(),
        dbService.getEmployees(),
      ]);
      setBookings(b || []);
      setSessions(s || []);
      setSupportTickets(t || []);
      setEmployees(emps || []);
      // Load assignments from local cache (also synced to Supabase)
      setAssignments(dbService.getLocalAssignments());
    } catch (err) {
      console.error('Failed to load Supabase data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // If employee switches to a tab they can't access, reset to orders
  useEffect(() => {
    if (!isAdmin && (currentTab === 'overview' || currentTab === 'team')) {
      setCurrentTab('orders');
    }
  }, [isAdmin, currentTab]);

  const handleUpdateBookingStatus = async (
    userId: string,
    status: FreightBooking['status'],
    remarks?: string
  ) => {
    const booking = bookings.find((b) => b.user_id === userId);
    await dbService.updateBookingStatus(
      userId,
      status,
      remarks,
      booking?.phone,
      booking?.contact_name
    );
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

  const handleAssignLead = async (userId: string, employeeId: string) => {
    await dbService.assignLead(userId, employeeId);
    setAssignments(dbService.getLocalAssignments());
  };

  const handleTransferLead = async (userId: string, newEmployeeId: string, note: string) => {
    await dbService.transferLead(userId, newEmployeeId, note);
    setAssignments(dbService.getLocalAssignments());
  };

  const handleSaveEmployee = async (emp: Omit<Employee, 'id' | 'created_at'>) => {
    await dbService.upsertEmployee(emp);
    const updated = dbService.getLocalEmployees();
    setEmployees(updated);
  };

  const handleDeactivateEmployee = async (employeeId: string) => {
    await dbService.deactivateEmployee(employeeId);
    const updated = dbService.getLocalEmployees();
    setEmployees(updated);
  };

  const handleExportCsv = () => {
    if (bookings.length === 0) return;

    const headers = [
      'Date', 'Status', 'Origin', 'Destination', 'Cargo Type',
      'Vehicle / Container', 'Weight', 'Loading Date', 'Time Slot',
      'Contact Person', 'Primary Phone', 'Alternate Phone', 'Company Name', 'Remarks',
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
          title: isAdmin ? 'Freight Orders Desk' : 'My Assigned Leads',
          subtitle: isAdmin
            ? 'Live customer cargo demands with 1-click WhatsApp quote dispatch'
            : `Leads assigned to ${currentEmployee?.name || 'you'} — update status and add notes`,
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
      case 'team':
        return {
          title: 'Team Management',
          subtitle: 'Manage employees, assign leads, and track team performance',
        };
      default:
        return {
          title: 'Traket Logistics Desk',
          subtitle: 'WhatsApp Automation Dispatch Hub',
        };
    }
  };

  const { title, subtitle } = getTabHeader();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        clientProfile={clientProfile}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        role={role}
        employeeName={currentEmployee?.name}
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
          role={role}
          currentEmployee={currentEmployee}
          employees={employees}
          onSwitchToAdmin={switchToAdmin}
          onSwitchToEmployee={switchToEmployee}
        />

        {/* Dynamic Views */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentTab === 'orders' && (
            <BookingsTable
              bookings={bookings}
              searchQuery={searchQuery}
              onUpdateStatus={handleUpdateBookingStatus}
              role={role}
              currentEmployee={currentEmployee}
              employees={employees}
              assignments={assignments}
              onAssignLead={handleAssignLead}
              onTransferLead={handleTransferLead}
            />
          )}

          {currentTab === 'overview' && isAdmin && (
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

          {currentTab === 'team' && isAdmin && (
            <TeamManager
              employees={employees}
              bookings={bookings}
              assignments={assignments}
              onSaveEmployee={handleSaveEmployee}
              onDeactivateEmployee={handleDeactivateEmployee}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <RoleProvider>
      <AppInner />
    </RoleProvider>
  );
}

export default App;
