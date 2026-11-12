import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { BookingsTable } from './components/tables/BookingsTable';
import { InquiriesDesk } from './components/inquiries/InquiriesDesk';
import { TeamManager } from './components/team/TeamManager';
import { ArchiveDesk } from './components/archive/ArchiveDesk';
import { PriorityDispatchModal } from './components/notifications/PriorityDispatchModal';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { LoginPage } from './components/auth/LoginPage';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';
import { RoleProvider, useRole } from './context/RoleContext';
import { Loader2, Truck } from 'lucide-react';
import { dbService, ACTIVE_CLIENT_PROFILE } from './services/supabase';
import {
  initAudioContext,
  playDispatchChime,
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

// Storage key helpers for tracking alerted, dismissed, and viewed leads
const GET_ALERT_STORAGE_KEY = (roleKey: string) => `traket_seen_alerts_${roleKey}`;
const GET_DISMISSED_STORAGE_KEY = (roleKey: string) => `traket_dismissed_alerts_${roleKey}`;
const GET_VIEWED_STORAGE_KEY = (roleKey: string) => `traket_viewed_alerts_${roleKey}`;

const getRoleKey = (currentRole: string, activeEmployee: Employee | null) => {
  return currentRole === 'employee' && activeEmployee ? activeEmployee.employee_id : 'admin';
};

// Inner app that has access to RoleContext
function AppInner() {
  const {
    isAuthenticated,
    isAuthChecking,
    authRole,
    role,
    currentAdmin,
    currentEmployee,
    mustChangePassword,
    switchToAdmin,
    switchToEmployee,
    loginAsAdmin,
    loginAsEmployee,
    clearMustChangePassword,
    logout,
  } = useRole();
  const isAdmin = role === 'admin';

  const [currentTab, setCurrentTab] = useState<DashboardTab>('orders');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
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

      const currentAssignments = await dbService.getAssignments();

      // Load assignments from local cache / database
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
    // 1. Identify relevant leads based on active role
    let relevantBookings: FreightBooking[] = [];
    const roleKey = getRoleKey(currentRole, activeEmployee);

    if (currentRole === 'employee' && activeEmployee) {
      relevantBookings = currentBookings.filter((b) => {
        if (b.status !== 'new') return false;
        const assignment = currentAssignments[b.user_id];
        return assignment && assignment.assigned_to === activeEmployee.employee_id;
      });
    } else {
      // In Admin view, track all new leads requiring dispatch or attention
      relevantBookings = currentBookings.filter((b) => b.status === 'new');
    }

    // Read persistent dismissed, viewed, and seenModal IDs from localStorage
    let dismissedIds: string[] = [];
    let viewedIds: string[] = [];
    let seenModalIds: string[] = [];
    try {
      dismissedIds = JSON.parse(localStorage.getItem(GET_DISMISSED_STORAGE_KEY(roleKey)) || '[]');
      viewedIds = JSON.parse(localStorage.getItem(GET_VIEWED_STORAGE_KEY(roleKey)) || '[]');
      seenModalIds = JSON.parse(localStorage.getItem(GET_ALERT_STORAGE_KEY(roleKey)) || '[]');
    } catch (_) {}

    const dismissedSet = new Set(dismissedIds);
    const viewedSet = new Set(viewedIds);

    // CRITICAL FIX: Filter OUT any leads that employee dismissed so they NEVER reappear on poll!
    const activeRelevantBookings = relevantBookings.filter((b) => !dismissedSet.has(b.user_id));

    // Map to LeadNotification objects
    const mapped: LeadNotification[] = activeRelevantBookings.map((b) => {
      const assignment = currentAssignments[b.user_id];
      const isOverdue = Date.now() - new Date(b.updated_at).getTime() > 25 * 60 * 1000;
      const isViewed = viewedSet.has(b.user_id);

      return {
        id: `alert_${b.user_id}`,
        bookingId: b.user_id,
        title: isOverdue ? 'Overdue Lead Follow-up' : (assignment?.assigned_to ? 'Assigned Lead' : 'New Freight Booking'),
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
        status: isViewed ? 'viewed' : 'pending',
        urgency: isOverdue ? 'urgent' : 'high',
        type: isOverdue ? 'sla_reminder' : 'new_lead',
        isDecisionMaker: b.is_decision_maker,
        approverName: b.approver_name,
        approverPhone: b.approver_phone,
        approverRole: b.approver_role,
      };
    });

    setNotifications(mapped);

    // On initial page mount, populate the tray silently without bursting modals for old existing leads
    if (!hasInitializedAlertsRef.current) {
      hasInitializedAlertsRef.current = true;
      const allCurrentIds = mapped.map((m) => m.bookingId);
      const combinedSeen = Array.from(new Set([...seenModalIds, ...allCurrentIds]));
      try {
        localStorage.setItem(GET_ALERT_STORAGE_KEY(roleKey), JSON.stringify(combinedSeen));
      } catch (_) {}
      return;
    }

    // For any fresh leads arriving after initial load, pop up the Priority Blur Alert for employees
    if (currentRole === 'employee' && activeEmployee) {
      const unseen = mapped.find((m) => m.status === 'pending' && !seenModalIds.includes(m.bookingId));
      if (unseen && !activeDispatchAlert) {
        setActiveDispatchAlert(unseen);

        // Record as seen in this browser so it doesn't pop up again endlessly
        try {
          localStorage.setItem(GET_ALERT_STORAGE_KEY(roleKey), JSON.stringify([...seenModalIds, unseen.bookingId]));
        } catch (_) {}

        // Play notification chime
        playDispatchChime();
        const originCity = (unseen.origin || 'Source').split(',')[0].trim();
        const destCity = (unseen.destination || 'Destination').split(',')[0].trim();

        // Browser Desktop Push Notification (works even if user is on another tab)
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 New Lead Assigned - Traket CRM', {
              body: `${unseen.customerName}: ${originCity} ➔ ${destCity} (${unseen.vehicleType})`,
            });
          }
        } catch (_) {}
      }
    }
  };

  useEffect(() => {
    if (isAuthChecking) return;

    if (!isAuthenticated) {
      setBookings([]);
      setSessions([]);
      setSupportTickets([]);
      setEmployees([]);
      setAssignments({});
      setNotifications([]);
      setActiveDispatchAlert(null);
      setIsNotificationDrawerOpen(false);
      setIsChangePasswordOpen(false);
      setCurrentTab('orders');
      dbService.clearLocalCaches();
      return;
    }

    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 20000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isAuthChecking]);

  // When role or active employee changes, refresh notifications
  useEffect(() => {
    if (bookings.length > 0) {
      syncLeadNotifications(bookings, assignments, role, currentEmployee);
    }
  }, [role, currentEmployee, bookings, assignments]);

  // If employee switches to a tab they can't access, reset to orders
  useEffect(() => {
    if (!isAdmin && (currentTab === 'overview' || currentTab === 'team' || currentTab === 'archive')) {
      setCurrentTab('orders');
    }
  }, [isAdmin, currentTab]);

  // Action: Open and jump straight to the lead row from a notification
  const handleOpenLeadFromNotification = (bookingId: string) => {
    const roleKey = getRoleKey(role, currentEmployee);
    setActiveDispatchAlert(null);
    setCurrentTab('orders');
    setHighlightedBookingId(bookingId);

    // Persist as viewed
    try {
      const key = GET_VIEWED_STORAGE_KEY(roleKey);
      const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!prev.includes(bookingId)) {
        localStorage.setItem(key, JSON.stringify([...prev, bookingId]));
      }
    } catch (_) {}

    // Mark as attended in local notification state
    setNotifications((prev) =>
      prev.map((n) => (n.bookingId === bookingId ? { ...n, status: 'viewed' } : n))
    );
  };

  // Action: Dock the popup into the tray
  const handleDockToTray = React.useCallback((_notifId: string) => {
    setActiveDispatchAlert(null);
  }, []);

  // Action: Dismiss a single notification from tray (cuts it permanently so it never reappears!)
  const handleDismissNotification = (notifId: string) => {
    const roleKey = getRoleKey(role, currentEmployee);
    const target = notifications.find((n) => n.id === notifId);
    const bookingId = target ? target.bookingId : notifId.replace(/^alert_/, '');

    try {
      const key = GET_DISMISSED_STORAGE_KEY(roleKey);
      const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!prev.includes(bookingId)) {
        localStorage.setItem(key, JSON.stringify([...prev, bookingId]));
      }
    } catch (_) {}

    setNotifications((prev) => prev.filter((n) => n.id !== notifId && n.bookingId !== bookingId));
    if (activeDispatchAlert?.bookingId === bookingId) {
      setActiveDispatchAlert(null);
    }
  };

  // Action: Clear all notifications from tray (persists so none reappear on poll!)
  const handleClearAllNotifications = () => {
    const roleKey = getRoleKey(role, currentEmployee);
    const bookingIdsToDismiss = notifications.map((n) => n.bookingId);

    try {
      const key = GET_DISMISSED_STORAGE_KEY(roleKey);
      const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      const combined = Array.from(new Set([...prev, ...bookingIdsToDismiss]));
      localStorage.setItem(key, JSON.stringify(combined));
    } catch (_) {}

    setNotifications([]);
    setActiveDispatchAlert(null);
  };

  // Action: Mark all notifications as seen / attended
  const handleMarkAllSeenNotifications = () => {
    const roleKey = getRoleKey(role, currentEmployee);
    const allBookingIds = notifications.map((n) => n.bookingId);

    try {
      const key = GET_VIEWED_STORAGE_KEY(roleKey);
      const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      const combined = Array.from(new Set([...prev, ...allBookingIds]));
      localStorage.setItem(key, JSON.stringify(combined));
    } catch (_) {}

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: 'viewed' as const }))
    );
    setActiveDispatchAlert(null);
  };

  // Action: Mark a single notification as seen / attended
  const handleMarkSeenNotification = (notifId: string) => {
    const roleKey = getRoleKey(role, currentEmployee);
    const target = notifications.find((n) => n.id === notifId);
    const bookingId = target ? target.bookingId : notifId.replace(/^alert_/, '');

    try {
      const key = GET_VIEWED_STORAGE_KEY(roleKey);
      const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!prev.includes(bookingId)) {
        localStorage.setItem(key, JSON.stringify([...prev, bookingId]));
      }
    } catch (_) {}

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notifId || n.bookingId === bookingId ? { ...n, status: 'viewed' as const } : n
      )
    );
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
    try {
      if (!employeeId) {
        await dbService.unassignLead(userId);
      } else {
        await dbService.assignLead(userId, employeeId);
      }
      setAssignments(dbService.getLocalAssignments());
    } catch (err: any) {
      console.error('Failed to update lead assignment:', err);
      alert(`Assignment update failed: ${err?.message || 'Unable to update Supabase database'}`);
    }
  };

  const handleTransferLead = async (userId: string, newEmployeeId: string, note: string) => {
    try {
      await dbService.transferLead(userId, newEmployeeId, note);
      setAssignments(dbService.getLocalAssignments());
    } catch (err: any) {
      console.error('Failed to transfer lead:', err);
      alert(`Lead transfer failed: ${err?.message || 'Unable to update Supabase database'}`);
    }
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
    const updated = await dbService.getEmployees();
    setEmployees(updated);
  };

  const handleDeactivateEmployee = async (employeeId: string) => {
    await dbService.deactivateEmployee(employeeId);
    const updated = await dbService.getEmployees();
    setEmployees(updated);
  };

  const handleExportCsv = () => {
    if (bookings.length === 0) return;

    const headers = [
      'Date', 'Status', 'Assigned Specialist', 'Specialist ID', 'Assignment Date', 'Transfer Note',
      'Origin', 'Destination', 'Cargo Type', 'Vehicle / Container', 'Weight', 'Loading Date', 'Time Slot',
      'Commercial Approver', 'Approver Phone', 'Approver Role', 'Authority Type',
      'Lead Submitter', 'Submitter Phone', 'Company Name', 'Remarks',
    ];

    const rows = bookings.map((b) => {
      const assignment = assignments[b.user_id];
      const assignedEmp = assignment?.assigned_to
        ? employees.find((e) => e.employee_id === assignment.assigned_to)
        : null;
      return [
        `"${new Date(b.updated_at).toLocaleDateString()}"`,
        `"${b.status}"`,
        `"${assignedEmp?.name || 'Unassigned'}"`,
        `"${assignedEmp?.employee_id || ''}"`,
        `"${assignment?.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : ''}"`,
        `"${(assignment?.transfer_note || '').replace(/"/g, '""')}"`,
        `"${b.originCity || b.origin}"`,
        `"${b.destinationCity || b.destination}"`,
        `"${b.cargo_type}"`,
        `"${b.vehicle_or_container}"`,
        `"${b.weight}"`,
        `"${b.loading_date}"`,
        `"${b.time_slot}"`,
        `"${b.approver_name || b.contact_name || ''}"`,
        `"${b.approver_phone || b.alternate_phone || b.phone || ''}"`,
        `"${b.approver_role || ''}"`,
        `"${b.is_decision_maker === false ? 'Corporate (On Behalf)' : 'Direct Decision-Maker (Self)'}"`,
        `"${b.submitter_name || b.contact_name || ''}"`,
        `"${b.submitter_phone || b.phone || ''}"`,
        `"${b.company_name}"`,
        `"${(b.remarks || '').replace(/"/g, '""')}"`,
      ];
    });

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
      case 'archive':
        return {
          title: 'Data Archive & Statements',
          subtitle: 'Bank-style periodic statements, audited ledger, and month-wise backup archives',
        };
      default:
        return {
          title: 'Traket Logistics Desk',
          subtitle: 'WhatsApp Automation Dispatch Hub',
        };
    }
  };

  const { title, subtitle } = getTabHeader();

  if (isAuthChecking) {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm mb-4">
          <Truck className="w-6 h-6" />
        </div>
        <div className="flex items-center space-x-2.5 text-sm font-semibold text-slate-700">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Verifying Traket CRM session...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, render the high-end Traket Logistics Login Portal
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginAdmin={loginAsAdmin}
        onLoginEmployee={loginAsEmployee}
      />
    );
  }

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
        onLogout={logout}
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
          unreadNotificationsCount={notifications.filter((n) => n.status === 'pending').length}
          onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
          authRole={authRole}
          role={role}
          currentEmployee={currentEmployee}
          employees={employees}
          onSwitchToAdmin={switchToAdmin}
          onSwitchToEmployee={switchToEmployee}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={logout}
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
              bookings={bookings}
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

          {currentTab === 'archive' && isAdmin && (
            <ArchiveDesk
              bookings={bookings}
              sessions={sessions}
              supportTickets={supportTickets}
              employees={employees}
              assignments={assignments}
              onRefresh={loadData}
              isRefreshing={isRefreshing}
            />
          )}
        </main>
      </div>

      {/* 10-Second Priority Dispatch Full-Screen Blur Modal */}
      <PriorityDispatchModal
        notification={activeDispatchAlert}
        onOpenLead={handleOpenLeadFromNotification}
        onDockToTray={handleDockToTray}
      />

      {/* Notification Drawer (Pending Leads Tray) */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        onOpenLead={handleOpenLeadFromNotification}
        onDismiss={handleDismissNotification}
        onClearAll={handleClearAllNotifications}
        onMarkAllSeen={handleMarkAllSeenNotifications}
        onMarkSeen={handleMarkSeenNotification}
        onTriggerTestAlert={handleTriggerTestAlert}
      />

      {/* Change Password Modal (manual or forced first-login default password rotation) */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen || mustChangePassword}
        forced={mustChangePassword}
        userLabel={
          authRole === 'admin'
            ? `${currentAdmin?.name || 'Administrator'} (${currentAdmin?.email || 'admin'})`
            : `${currentEmployee?.name || 'Employee'} (${currentEmployee?.employee_id || ''})`
        }
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={() => {
          clearMustChangePassword();
          setIsChangePasswordOpen(false);
        }}
        onLogout={logout}
      />
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
