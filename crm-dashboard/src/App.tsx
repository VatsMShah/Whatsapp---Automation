import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { BookingsTable } from './components/tables/BookingsTable';
import { InquiriesDesk } from './components/inquiries/InquiriesDesk';
import { TeamManager } from './components/team/TeamManager';
import { PriorityDispatchModal } from './components/notifications/PriorityDispatchModal';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { RoleProvider, useRole } from './context/RoleContext';
import { dbService, ACTIVE_CLIENT_PROFILE } from './services/supabase';
import {
  initAudioContext,
  playDispatchChime,
  speakLeadAnnouncement,
} from './utils/sound';
import {
  FreightBooking,
  SessionRecord,
  SupportTicket,
  ClientCompanyProfile,
  DashboardTab,
  Employee,
  LeadAssignment,
  LeadNotification,
} from './types';

// Storage key helper for tracking alerted leads
const GET_ALERT_STORAGE_KEY = (roleKey: string) => `traket_seen_alerts_${roleKey}`;

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
  const [isAutoLeadEnabled, setIsAutoLeadEnabled] = useState<boolean>(() =>
    dbService.isAutoLeadAssignmentEnabled()
  );

  // Lead Notifications & Dispatch Modal State
  const [notifications, setNotifications] = useState<LeadNotification[]>([]);
  const [activeDispatchAlert, setActiveDispatchAlert] = useState<LeadNotification | null>(null);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const hasInitializedAlertsRef = useRef(false);

  // Unlock audio on first user interaction
  useEffect(() => {
    const handleFirstUserInteraction = () => {
      initAudioContext();
    };
    window.addEventListener('click', handleFirstUserInteraction, { once: true });
    window.addEventListener('keydown', handleFirstUserInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstUserInteraction);
      window.removeEventListener('keydown', handleFirstUserInteraction);
    };
  }, []);

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

      let currentAssignments = dbService.getLocalAssignments();

      // If vehicle auto-lead assignment is enabled, auto-assign unassigned leads based on vehicle type
      if (b && b.length > 0 && emps && emps.length > 0 && dbService.isAutoLeadAssignmentEnabled()) {
        const autoRes = await dbService.autoAssignBookingsByVehicle(b, emps, currentAssignments);
        currentAssignments = autoRes.updatedAssignments;
      }

      // Load assignments from local cache (also synced to Supabase)
      setAssignments(currentAssignments);

      // Evaluate and trigger lead notifications
      syncLeadNotifications(b || [], currentAssignments, role, currentEmployee);
    } catch (err) {
      console.error('Failed to load Supabase data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Evaluate lead notifications for the active user (Admin or Employee)
  const syncLeadNotifications = (
    currentBookings: FreightBooking[],
    currentAssignments: Record<string, LeadAssignment>,
    currentRole: string,
    activeEmployee: Employee | null
  ) => {
    // Lead notifications are strictly for employees, not the admin panel
    if (currentRole === 'admin' || !activeEmployee) {
      setNotifications([]);
      setActiveDispatchAlert(null);
      return;
    }

    // 1. Identify relevant new leads assigned to this employee
    const relevantBookings = currentBookings.filter((b) => {
      if (b.status !== 'new') return false;
      const assignment = currentAssignments[b.user_id];
      return assignment && assignment.assigned_to === activeEmployee.employee_id;
    });

    const roleKey = activeEmployee.employee_id;
    const storageKey = GET_ALERT_STORAGE_KEY(roleKey);
    let seenIds: string[] = [];
    try {
      seenIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (_) {}

    // Map to LeadNotification objects
    const mapped: LeadNotification[] = relevantBookings.map((b) => {
      const assignment = currentAssignments[b.user_id];
      const isOverdue = Date.now() - new Date(b.updated_at).getTime() > 25 * 60 * 1000;
      return {
        id: `alert_${b.user_id}`,
        bookingId: b.user_id,
        title: isOverdue ? 'Overdue Lead Follow-up' : 'New Freight Booking',
        customerName: b.contact_name || 'Inquiry Contact',
        phone: b.phone,
        companyName: b.company_name,
        origin: b.originCity || b.origin,
        destination: b.destinationCity || b.destination,
        vehicleType: b.vehicle_or_container,
        material: b.material_or_line,
        weight: b.weight,
        assignedTo: assignment?.assigned_to,
        assignedAt: assignment?.assigned_at,
        createdAt: b.updated_at,
        status: 'pending',
        urgency: isOverdue ? 'urgent' : 'high',
        type: isOverdue ? 'sla_reminder' : 'new_lead',
      };
    });

    setNotifications(mapped);

    // On initial page mount, populate the tray silently without bursting modals for old existing leads
    if (!hasInitializedAlertsRef.current) {
      hasInitializedAlertsRef.current = true;
      const allCurrentIds = mapped.map((m) => m.bookingId);
      const combinedSeen = Array.from(new Set([...seenIds, ...allCurrentIds]));
      try {
        localStorage.setItem(storageKey, JSON.stringify(combinedSeen));
      } catch (_) {}
      return;
    }

    // For any fresh leads arriving after initial load, pop up the Priority Blur Alert!
    const unseen = mapped.find((m) => !seenIds.includes(m.bookingId));
    if (unseen && !activeDispatchAlert) {
      setActiveDispatchAlert(unseen);

      // Record as seen in this browser so it doesn't pop up again endlessly
      try {
        localStorage.setItem(storageKey, JSON.stringify([...seenIds, unseen.bookingId]));
      } catch (_) {}

      // Play audio chime and voice announcement
      playDispatchChime();
      const originCity = (unseen.origin || 'Source').split(',')[0].trim();
      const destCity = (unseen.destination || 'Destination').split(',')[0].trim();
      speakLeadAnnouncement(`New lead assigned from ${originCity} to ${destCity}.`);

      // Browser Desktop Push Notification (works even if user is on another tab)
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🚨 New Lead Assigned - Traket CRM', {
            body: `${unseen.customerName}: ${originCity} ➔ ${destCity} (${unseen.vehicleType})`,
          });
        }
      } catch (_) {}
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // When role or active employee changes, refresh notifications (strictly for employee view)
  useEffect(() => {
    if (role === 'admin') {
      setNotifications([]);
      setActiveDispatchAlert(null);
      setIsNotificationDrawerOpen(false);
    } else if (bookings.length > 0) {
      syncLeadNotifications(bookings, assignments, role, currentEmployee);
    }
  }, [role, currentEmployee]);

  // If employee switches to a tab they can't access, reset to orders
  useEffect(() => {
    if (!isAdmin && (currentTab === 'overview' || currentTab === 'team')) {
      setCurrentTab('orders');
    }
  }, [isAdmin, currentTab]);

  // Action: Open and jump straight to the lead row from a notification
  const handleOpenLeadFromNotification = (bookingId: string) => {
    setActiveDispatchAlert(null);
    setCurrentTab('orders');
    setHighlightedBookingId(bookingId);

    // Mark as attended in local notification state
    setNotifications((prev) =>
      prev.map((n) => (n.bookingId === bookingId ? { ...n, status: 'viewed' } : n))
    );
  };

  // Action: Dock the popup into the tray
  const handleDockToTray = React.useCallback((_notifId: string) => {
    setActiveDispatchAlert(null);
  }, []);

  // Action: Dismiss a single notification from tray
  const handleDismissNotification = (notifId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  };

  // Action: Clear all notifications from tray
  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  // Action: Trigger a complete test alert (Modal + Blur + Chime + Voice)
  const handleTriggerTestAlert = () => {
    const sampleAlert: LeadNotification = {
      id: `test_${Date.now()}`,
      bookingId: bookings[0]?.user_id || 'test_booking_sample',
      title: '🚨 Test Priority Dispatch Alert',
      customerName: 'Sanjay Sharma (ABC Logistics)',
      phone: '+91 98205 00159',
      companyName: 'ABC Transporters Pvt Ltd',
      origin: 'Mumbai, Maharashtra',
      destination: 'Ahmedabad, Gujarat',
      vehicleType: '32ft MXL Container',
      material: 'Industrial FMCG Goods',
      weight: '14 MT',
      createdAt: new Date().toISOString(),
      status: 'pending',
      urgency: 'high',
      type: 'new_lead',
    };
    setActiveDispatchAlert(sampleAlert);
    playDispatchChime();
    speakLeadAnnouncement('Test lead alert: Mumbai to Ahmedabad container inquiry.');
  };

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

    // If status is updated away from 'new', remove from pending notifications
    if (status !== 'new' || remarks) {
      setNotifications((prev) => prev.filter((n) => n.bookingId !== userId));
      if (activeDispatchAlert?.bookingId === userId) {
        setActiveDispatchAlert(null);
      }
    }
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
    if (!employeeId) {
      await dbService.unassignLead(userId);
    } else {
      await dbService.assignLead(userId, employeeId);
    }
    setAssignments(dbService.getLocalAssignments());
  };

  const handleTransferLead = async (userId: string, newEmployeeId: string, note: string) => {
    await dbService.transferLead(userId, newEmployeeId, note);
    setAssignments(dbService.getLocalAssignments());
  };

  const handleToggleAutoLead = (enabled: boolean) => {
    dbService.setAutoLeadAssignmentEnabled(enabled);
    setIsAutoLeadEnabled(enabled);
  };

  const handleTriggerAutoAssign = async () => {
    if (bookings.length === 0 || employees.length === 0) return;
    const res = await dbService.autoAssignBookingsByVehicle(bookings, employees, assignments);
    setAssignments(res.updatedAssignments);
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
          unreadNotificationsCount={isAdmin ? 0 : notifications.filter((n) => n.status === 'pending').length}
          onOpenNotifications={isAdmin ? undefined : () => setIsNotificationDrawerOpen(true)}
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
              highlightedBookingId={highlightedBookingId}
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
              employees={employees}
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
              isAutoAssignEnabled={isAutoLeadEnabled}
              onToggleAutoAssign={handleToggleAutoLead}
              onTriggerAutoAssign={handleTriggerAutoAssign}
            />
          )}
        </main>
      </div>

      {/* 10-Second Priority Dispatch Full-Screen Blur Modal (Employee View Only) */}
      {!isAdmin && (
        <PriorityDispatchModal
          notification={activeDispatchAlert}
          onOpenLead={handleOpenLeadFromNotification}
          onDockToTray={handleDockToTray}
        />
      )}

      {/* Notification Drawer (Pending Leads Tray - Employee View Only) */}
      {!isAdmin && (
        <NotificationDrawer
          isOpen={isNotificationDrawerOpen}
          onClose={() => setIsNotificationDrawerOpen(false)}
          notifications={notifications}
          onOpenLead={handleOpenLeadFromNotification}
          onDismiss={handleDismissNotification}
          onClearAll={handleClearAllNotifications}
          onTriggerTestAlert={handleTriggerTestAlert}
        />
      )}
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
