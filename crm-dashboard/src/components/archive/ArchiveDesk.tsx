import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Filter,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Building2,
  PhoneCall,
  UserCheck,
  Truck,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Printer,
  ChevronDown,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react';
import {
  FreightBooking,
  SessionRecord,
  SupportTicket,
  Employee,
  LeadAssignment,
} from '../../types';

interface ArchiveDeskProps {
  bookings: FreightBooking[];
  sessions: SessionRecord[];
  supportTickets: SupportTicket[];
  employees: Employee[];
  assignments: Record<string, LeadAssignment>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

type PeriodPreset = 'this_month' | 'last_month' | 'this_week' | 'last_week' | 'custom';
type DataScope = 'all' | 'orders' | 'inquiries' | 'support';

interface StatementRecord {
  id: string;
  refId: string;
  type: 'order' | 'inquiry' | 'support';
  date: Date;
  dateStr: string;
  phone: string;
  customerName: string;
  companyName: string;
  origin: string;
  destination: string;
  vehicleType: string;
  vehicleSubType: string;
  weight: string;
  cargoType: string;
  approverName: string;
  approverPhone: string;
  approverRole: string;
  submitterName: string;
  submitterPhone: string;
  status: string;
  assignedToName: string;
  remarks: string;
  raw: FreightBooking | SessionRecord | SupportTicket;
}

export const ArchiveDesk: React.FC<ArchiveDeskProps> = ({
  bookings,
  sessions,
  supportTickets,
  employees,
  assignments,
  onRefresh,
  isRefreshing,
}) => {
  // Period filter states
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(''); // format YYYY-MM
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [scopeFilter, setScopeFilter] = useState<DataScope>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to extract short readable reference ID
  const extractShortId = (idStr: string) => {
    if (!idStr) return 'TRK-000';
    if (idStr.includes('_')) {
      return `TRK-${idStr.split('_').slice(1).join('_')}`;
    }
    const cleanDigits = idStr.replace(/[^0-9]/g, '');
    return cleanDigits.length >= 6 ? `TRK-${cleanDigits.slice(-6)}` : `TRK-${cleanDigits || idStr}`;
  };

  // Helper to safely parse dates
  const parseSafeDate = (dStr?: string): Date => {
    if (!dStr) return new Date(0);
    const parsed = new Date(dStr);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  // Format date cleanly like a bank statement: "04 Nov 2026, 11:09 AM"
  const formatDateTime = (d: Date): string => {
    if (isNaN(d.getTime()) || d.getTime() === 0) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format phone cleanly (+91 XXXXX XXXXX)
  const formatPhone = (phone?: string) => {
    if (!phone) return '—';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    if (clean.length === 12 && clean.startsWith('91')) {
      return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
    }
    return phone;
  };

  // Map employee name from assignments
  const getAssignedName = (userId: string): string => {
    const asgn = assignments[userId];
    if (!asgn || !asgn.assigned_to) return 'Unassigned';
    const emp = employees.find((e) => e.employee_id === asgn.assigned_to || e.id === asgn.assigned_to);
    return emp ? `${emp.name} (${emp.employee_id})` : asgn.assigned_to;
  };

  // Build unified statement records list
  const unifiedRecords: StatementRecord[] = useMemo(() => {
    const list: StatementRecord[] = [];

    // 1. Freight Bookings
    bookings.forEach((b) => {
      const d = parseSafeDate(b.updated_at);
      list.push({
        id: `book_${b.user_id}`,
        refId: extractShortId(b.user_id),
        type: 'order',
        date: d,
        dateStr: d.toISOString(),
        phone: b.phone || '',
        customerName: b.contact_name || b.submitter_name || 'Customer',
        companyName: b.company_name || 'Direct Business',
        origin: b.origin || '—',
        destination: b.destination || '—',
        vehicleType: b.vehicle_or_container || '—',
        vehicleSubType: b.vehicle_sub_type || 'Standard',
        weight: b.weight || '—',
        cargoType: b.cargo_type || 'Domestic',
        approverName: b.approver_name || 'Same as Submitter',
        approverPhone: b.approver_phone || b.phone || '—',
        approverRole: b.approver_role || (b.is_decision_maker ? 'Direct Authority' : 'Pending Verification'),
        submitterName: b.submitter_name || b.contact_name || 'Submitter',
        submitterPhone: b.submitter_phone || b.phone || '—',
        status: b.status || 'new',
        assignedToName: getAssignedName(b.user_id),
        remarks: b.remarks || '',
        raw: b,
      });
    });

    // 2. Half-way sessions (Inquiries desk)
    sessions.forEach((s) => {
      // If already a completed booking, avoid duplicate
      const alreadyInBookings = bookings.some((b) => b.user_id === s.user_id);
      if (alreadyInBookings) return;

      const d = parseSafeDate(s.updated_at);
      const data = s.data || {};
      list.push({
        id: `session_${s.user_id}`,
        refId: extractShortId(s.user_id),
        type: 'inquiry',
        date: d,
        dateStr: d.toISOString(),
        phone: s.phone || '',
        customerName: data.contactName || data.name || 'WhatsApp Visitor',
        companyName: data.companyName || 'Unregistered',
        origin: data.loadingYard || data.origin || data.loadingPin || '—',
        destination: data.unloadingAddress || data.destination || data.unloadingPin || '—',
        vehicleType: data.vehicleType || 'Inquiry',
        vehicleSubType: data.vehicleSubType || '—',
        weight: data.weight || '—',
        cargoType: data.cargoType || 'Domestic',
        approverName: data.approverName || '—',
        approverPhone: data.approverPhone || '—',
        approverRole: data.approverRole || '—',
        submitterName: data.submitterName || data.contactName || 'Visitor',
        submitterPhone: s.phone || '—',
        status: `Dropped Off (${s.state || 'Incomplete'})`,
        assignedToName: getAssignedName(s.user_id),
        remarks: `Stopped at step: ${s.state || 'Initial'}`,
        raw: s,
      });
    });

    // 3. Support Tickets
    supportTickets.forEach((t) => {
      const d = parseSafeDate(t.updated_at);
      list.push({
        id: `support_${t.user_id}`,
        refId: extractShortId(t.user_id),
        type: 'support',
        date: d,
        dateStr: d.toISOString(),
        phone: t.phone || '',
        customerName: t.contact_name || 'Support User',
        companyName: 'Support Desk',
        origin: '—',
        destination: '—',
        vehicleType: 'Support Ticket',
        vehicleSubType: t.priority || 'Normal',
        weight: '—',
        cargoType: 'Help',
        approverName: '—',
        approverPhone: '—',
        approverRole: '—',
        submitterName: t.contact_name || 'User',
        submitterPhone: t.phone || '—',
        status: t.status || 'open',
        assignedToName: 'Help Desk',
        remarks: t.subject ? `${t.subject} - ${t.message || ''}` : t.message || '',
        raw: t,
      });
    });

    // Sort descending by date (newest first)
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [bookings, sessions, supportTickets, employees, assignments]);

  // Compute available historical months for fast dropdown navigation
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    unifiedRecords.forEach((r) => {
      if (r.date.getTime() > 0) {
        const y = r.date.getFullYear();
        const m = String(r.date.getMonth() + 1).padStart(2, '0');
        monthSet.add(`${y}-${m}`);
      }
    });
    // Add current month if empty
    const now = new Date();
    monthSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

    return Array.from(monthSet).sort().reverse().map((key) => {
      const [yearStr, monthStr] = key.split('-');
      const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return { key, label, year: parseInt(yearStr, 10), month: parseInt(monthStr, 10) - 1 };
    });
  }, [unifiedRecords]);

  // Calculate the active start and end Date bounds based on preset
  const { dateRangeStart, dateRangeEnd, periodLabel } = useMemo(() => {
    const now = new Date();

    if (selectedMonthKey) {
      const [y, m] = selectedMonthKey.split('-').map(Number);
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return { dateRangeStart: start, dateRangeEnd: end, periodLabel: label };
    }

    if (periodPreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        dateRangeStart: start,
        dateRangeEnd: end,
        periodLabel: `${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} (MTD)`,
      };
    }

    if (periodPreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        dateRangeStart: start,
        dateRangeEnd: end,
        periodLabel: `${start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} (Closed Month)`,
      };
    }

    if (periodPreset === 'this_week') {
      // Monday of current week
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(now.setDate(diffToMonday));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return {
        dateRangeStart: start,
        dateRangeEnd: end,
        periodLabel: `This Week (${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`,
      };
    }

    if (periodPreset === 'last_week') {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const start = new Date(now.setDate(diffToMonday));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return {
        dateRangeStart: start,
        dateRangeEnd: end,
        periodLabel: `Last Week (${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`,
      };
    }

    // Custom
    const start = new Date(`${customStartDate}T00:00:00`);
    const end = new Date(`${customEndDate}T23:59:59.999`);
    return {
      dateRangeStart: start,
      dateRangeEnd: end,
      periodLabel: `Custom (${customStartDate} to ${customEndDate})`,
    };
  }, [periodPreset, selectedMonthKey, customStartDate, customEndDate]);

  // Filter statement records by period, scope, and search query
  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter((r) => {
      // Date filter
      if (r.date.getTime() < dateRangeStart.getTime() || r.date.getTime() > dateRangeEnd.getTime()) {
        return false;
      }

      // Scope filter
      if (scopeFilter === 'orders' && r.type !== 'order') return false;
      if (scopeFilter === 'inquiries' && r.type !== 'inquiry') return false;
      if (scopeFilter === 'support' && r.type !== 'support') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          r.refId.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q) ||
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.vehicleType.toLowerCase().includes(q) ||
          r.approverName.toLowerCase().includes(q) ||
          r.approverPhone.includes(q) ||
          r.submitterName.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [unifiedRecords, dateRangeStart, dateRangeEnd, scopeFilter, searchQuery]);

  // Period Snapshot Metrics
  const metrics = useMemo(() => {
    const total = filteredRecords.length;
    const completedOrders = filteredRecords.filter((r) => r.type === 'order').length;
    const inquiries = filteredRecords.filter((r) => r.type === 'inquiry').length;
    const decisionMakersIdentified = filteredRecords.filter(
      (r) => r.approverPhone && r.approverPhone !== '—' && r.approverName !== 'Same as Submitter'
    ).length;

    // Vehicle breakdown
    const vehicleCounts: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      if (r.vehicleType && r.vehicleType !== '—' && r.vehicleType !== 'Inquiry') {
        const v = r.vehicleType.toLowerCase();
        if (v.includes('truck')) vehicleCounts['Truck'] = (vehicleCounts['Truck'] || 0) + 1;
        else if (v.includes('tempo')) vehicleCounts['Tempo'] = (vehicleCounts['Tempo'] || 0) + 1;
        else if (v.includes('container') || v.includes('fcl')) vehicleCounts['Container'] = (vehicleCounts['Container'] || 0) + 1;
        else if (v.includes('trailer') || v.includes('odc')) vehicleCounts['Trailer'] = (vehicleCounts['Trailer'] || 0) + 1;
        else vehicleCounts['Other'] = (vehicleCounts['Other'] || 0) + 1;
      }
    });

    const topVehicle = Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Truck';

    const conversionRate = total > 0 ? ((completedOrders / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      completedOrders,
      inquiries,
      decisionMakersIdentified,
      conversionRate,
      topVehicle,
      vehicleCounts,
    };
  }, [filteredRecords]);

  // Handler: Export Statement CSV
  const handleExportStatementCsv = () => {
    if (filteredRecords.length === 0) {
      alert('No records available in this period to export.');
      return;
    }

    const safeCsvCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    // Bank statement metadata header
    const metadataLines = [
      `"TRAKET LOGISTICS HUB - OFFICIAL PERIOD STATEMENT"`,
      `"Statement Period:",${safeCsvCell(periodLabel)}`,
      `"Date Range:",${safeCsvCell(`${dateRangeStart.toISOString().split('T')[0]} to ${dateRangeEnd.toISOString().split('T')[0]}`)}`,
      `"Generated At:",${safeCsvCell(new Date().toLocaleString('en-IN'))}`,
      `"Total Records in Statement:",${safeCsvCell(filteredRecords.length)}`,
      `"Completed Freight Orders:",${safeCsvCell(metrics.completedOrders)}`,
      `"Conversion Rate:",${safeCsvCell(`${metrics.conversionRate}%`)}`,
      `"---","---","---","---","---","---","---","---","---","---","---","---","---","---","---"`,
    ];

    const columnHeaders = [
      'Date & Time',
      'Reference ID',
      'Category',
      'Status',
      'Origin (Loading)',
      'Destination (Unloading)',
      'Vehicle Type',
      'Vehicle Subtype',
      'Weight / Capacity',
      'Cargo Type',
      'Decision-Maker Name',
      'Decision-Maker Phone',
      'Decision Authority Role',
      'Submitter Name',
      'Submitter Phone',
      'Company Name',
      'Assigned Specialist',
      'Remarks',
    ];

    const dataRows = filteredRecords.map((r) => [
      formatDateTime(r.date),
      r.refId,
      r.type.toUpperCase(),
      r.status,
      r.origin,
      r.destination,
      r.vehicleType,
      r.vehicleSubType,
      r.weight,
      r.cargoType,
      r.approverName,
      r.approverPhone,
      r.approverRole,
      r.submitterName,
      r.submitterPhone,
      r.companyName,
      r.assignedToName,
      r.remarks,
    ]);

    const csvContent = [
      ...metadataLines,
      columnHeaders.map(safeCsvCell).join(','),
      ...dataRows.map((row) => row.map(safeCsvCell).join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeFilenamePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.setAttribute('download', `TRAKET_Statement_${safeFilenamePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler: Download Month Backup Sheet
  const handleDownloadMonthBackup = (monthKeyToBackup: string) => {
    const [y, m] = monthKeyToBackup.split('-').map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    const monthRecords = unifiedRecords.filter(
      (r) => r.date.getTime() >= start.getTime() && r.date.getTime() <= end.getTime()
    );

    if (monthRecords.length === 0) {
      alert(`No records found for ${monthKeyToBackup} to backup.`);
      return;
    }

    const safeCsvCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const header = [
      `"TRAKET MONTHLY AUDIT BACKUP ARCHIVE - ${monthKeyToBackup}"`,
      `"Archived On:",${safeCsvCell(new Date().toISOString())}`,
      `"Total Month Records:",${safeCsvCell(monthRecords.length)}`,
      `""`,
      [
        'Timestamp',
        'Record ID',
        'Type',
        'Status',
        'Customer Phone',
        'Company',
        'Route Origin',
        'Route Destination',
        'Vehicle Category',
        'Vehicle Specs / Subtype',
        'Weight',
        'Approver Direct Phone',
        'Approver Name',
        'Submitter Phone',
        'Submitter Name',
        'Assigned Specialist',
        'Full Remarks',
      ].map(safeCsvCell).join(','),
    ];

    const rows = monthRecords.map((r) =>
      [
        r.dateStr,
        r.refId,
        r.type,
        r.status,
        r.phone,
        r.companyName,
        r.origin,
        r.destination,
        r.vehicleType,
        r.vehicleSubType,
        r.weight,
        r.approverPhone,
        r.approverName,
        r.submitterPhone,
        r.submitterName,
        r.assignedToName,
        r.remarks,
      ].map(safeCsvCell).join(',')
    );

    const blob = new Blob([[...header, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TRAKET_MONTHLY_BACKUP_${monthKeyToBackup}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50/70 overflow-y-auto">
      {/* Top Banner / Breadcrumb */}
      <div className="p-6 pb-4 max-w-7xl w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-blue-100 text-blue-800 border border-blue-200">
                Data Archive & Audit Ledger
              </span>
              <span className="text-xs text-slate-400 font-medium">Industry Standard</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center space-x-2">
              <span>Financial & Dispatch Statements</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Audited historical ledger, periodic bank-style statements, and automated month-wise backup exports.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Quick Refresh */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>

            {/* Print / PDF View */}
            <button
              onClick={() => window.print()}
              title="Print or Save as PDF"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>

            {/* Export Statement Button */}
            <button
              onClick={handleExportStatementCsv}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              <span>Export Period Statement (CSV)</span>
            </button>
          </div>
        </div>

        {/* BANK-STYLE STATEMENT SELECTOR CONTROL BAR */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 mt-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Presets and Month Dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Period:</span>
              </span>

              {/* Period Preset Pills */}
              <button
                onClick={() => {
                  setPeriodPreset('this_month');
                  setSelectedMonthKey('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  periodPreset === 'this_month' && !selectedMonthKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                📅 This Month
              </button>

              <button
                onClick={() => {
                  setPeriodPreset('last_month');
                  setSelectedMonthKey('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  periodPreset === 'last_month' && !selectedMonthKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⏮️ Last Month
              </button>

              <button
                onClick={() => {
                  setPeriodPreset('this_week');
                  setSelectedMonthKey('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  periodPreset === 'this_week' && !selectedMonthKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⚡ This Week
              </button>

              <button
                onClick={() => {
                  setPeriodPreset('last_week');
                  setSelectedMonthKey('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  periodPreset === 'last_week' && !selectedMonthKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⏪ Last Week
              </button>

              <button
                onClick={() => {
                  setPeriodPreset('custom');
                  setSelectedMonthKey('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  periodPreset === 'custom' && !selectedMonthKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🗓️ Custom Range
              </button>

              {/* Direct Historical Month Selector */}
              <div className="relative inline-block ml-1">
                <select
                  value={selectedMonthKey}
                  onChange={(e) => {
                    setSelectedMonthKey(e.target.value);
                  }}
                  className={`appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    selectedMonthKey
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <option value="" disabled className="text-slate-500 bg-white">
                    Month Statement...
                  </option>
                  {availableMonths.map((m) => (
                    <option key={m.key} value={m.key} className="text-slate-800 bg-white">
                      📁 {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none ${
                    selectedMonthKey ? 'text-white' : 'text-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* Month-wise Backup Button */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => {
                  const targetMonth = selectedMonthKey || availableMonths[0]?.key;
                  if (targetMonth) handleDownloadMonthBackup(targetMonth);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition"
                title="Download complete raw backup archive for the selected month"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Backup Month Sheet</span>
              </button>
            </div>
          </div>

          {/* Custom Date Range Pickers (shown when 'custom' is active) */}
          {periodPreset === 'custom' && !selectedMonthKey && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-600">Start Date:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-xs font-semibold text-slate-600">End Date:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 italic">
                Records between 00:00 of start date and 23:59 of end date will be included.
              </span>
            </div>
          )}

          {/* Secondary Filter & Search Row */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Scope selection */}
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              <span className="text-xs font-bold text-slate-400 uppercase mr-1">Scope:</span>
              {(['all', 'orders', 'inquiries', 'support'] as DataScope[]).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setScopeFilter(scope)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    scopeFilter === scope
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {scope === 'all' && 'All Records'}
                  {scope === 'orders' && `Orders (${bookings.length})`}
                  {scope === 'inquiries' && `Inquiries (${sessions.length})`}
                  {scope === 'support' && `Support (${supportTickets.length})`}
                </button>
              ))}
            </div>

            {/* Text Search */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone, approver, route, ref..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* PERIOD STATEMENT SNAPSHOT METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {/* Card 1: Total Statement Volume */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Statement Records
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{metrics.total}</div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center space-x-1 truncate">
              <span>Period:</span>
              <span className="font-semibold text-slate-700">{periodLabel}</span>
            </div>
          </div>

          {/* Card 2: Completed Orders */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Confirmed Orders
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600">{metrics.completedOrders}</div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center space-x-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span className="font-semibold text-emerald-700">{metrics.conversionRate}%</span>
              <span>period conversion</span>
            </div>
          </div>

          {/* Card 3: Decision-Maker Contacts */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Approvers Verified
              </span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-purple-600">
              {metrics.decisionMakersIdentified}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Commercial decision-maker captured
            </div>
          </div>

          {/* Card 4: Top Fleet Category */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Primary Fleet
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-700 truncate">
              {metrics.topVehicle}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">
              Dominant equipment in period
            </div>
          </div>
        </div>

        {/* BANK-STYLE AUDITED STATEMENT LEDGER */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Statement Header Strip */}
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black tracking-wider uppercase">
                Official Statement Ledger: {periodLabel}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 flex items-center space-x-3">
              <span>Showing {filteredRecords.length} Audited Entries</span>
              <span className="hidden md:inline">|</span>
              <span className="hidden md:inline font-mono">ID: STMT-TRAKET-{periodPreset.toUpperCase()}</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Ref ID / Scope</th>
                  <th className="py-3 px-4">Lane (Route)</th>
                  <th className="py-3 px-4">Vehicle & Specs</th>
                  <th className="py-3 px-4">Customer & Commercial Approver</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Assigned Specialist</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-semibold">No records found for this period.</span>
                        <span className="text-xs text-slate-400">
                          Try switching to "This Month" or adjusting your custom date filters.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const isOrder = r.type === 'order';
                    const isInquiry = r.type === 'inquiry';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition group">
                        {/* Date & Time */}
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                          <div>{formatDateTime(r.date)}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {r.dateStr.split('T')[0]}
                          </div>
                        </td>

                        {/* Ref ID & Scope */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            {r.refId}
                          </span>
                          <div className="mt-1">
                            {isOrder && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                📦 Order
                              </span>
                            )}
                            {isInquiry && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                💬 Inquiry
                              </span>
                            )}
                            {r.type === 'support' && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                🎧 Support
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Route Lane */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 flex items-center space-x-1">
                            <span className="truncate max-w-[120px]" title={r.origin}>
                              {r.origin || '—'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]" title={r.destination}>
                              {r.destination || '—'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                            {r.companyName}
                          </div>
                        </td>

                        {/* Vehicle & Specs */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 truncate max-w-[150px]">
                            {r.vehicleType}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">
                            {r.vehicleSubType} {r.weight !== '—' ? `• ${r.weight}` : ''}
                          </div>
                        </td>

                        {/* Customer & Approver */}
                        <td className="py-3 px-4">
                          {/* Submitter info */}
                          <div className="text-slate-800 font-semibold truncate max-w-[200px]">
                            {r.customerName}
                            {r.phone && (
                              <span className="text-slate-500 font-normal ml-1 font-mono text-[11px]">
                                ({formatPhone(r.phone)})
                              </span>
                            )}
                          </div>

                          {/* Commercial Approver (if different) */}
                          {r.approverPhone && r.approverPhone !== '—' && r.approverName !== 'Same as Submitter' && (
                            <div className="mt-1 flex items-center space-x-1 text-[11px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 w-fit">
                              <UserCheck className="w-3 h-3 text-purple-600 shrink-0" />
                              <span className="font-bold">Approver:</span>
                              <span className="truncate max-w-[120px]">{r.approverName}</span>
                              <span className="font-mono text-[10px]">({formatPhone(r.approverPhone)})</span>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${
                              r.status.includes('completed') || r.status.includes('confirmed')
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : r.status.includes('quoted')
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : r.status.includes('Dropped')
                                ? 'bg-slate-100 text-slate-600 border-slate-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>

                        {/* Assigned Specialist */}
                        <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                          {r.assignedToName}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition"
                              title="Direct Voice Call"
                            >
                              <PhoneCall className="w-3 h-3 text-slate-500" />
                              <span>Call</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Statement Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
            <span>
              End of Audited Statement • Generated with cryptographic timestamp for compliance
            </span>
            <span className="font-semibold text-slate-700 mt-1 sm:mt-0">
              Total {filteredRecords.length} records in {periodLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
