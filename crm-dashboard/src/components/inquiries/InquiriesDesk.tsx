import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LifeBuoy,
  Phone,
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Sparkles,
  Send,
  X,
  Info,
  ShieldCheck,
  Check,
  Loader2,
  Users,
  ChevronRight,
  Bot,
  Zap,
  Layers,
  Search,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import {
  SessionRecord,
  SupportTicket,
  Employee,
  SessionAssignment,
  SessionReminderLog,
  FreightBooking,
} from '../../types';
import {
  sendReminderStage,
  formatStateLabel,
  getReminder1Text,
  getReminder2Text,
  getReminder3Text,
  REMINDER_3_BUTTONS,
  SUPPORT_PHONE_DISPLAY,
} from '../../services/whatsapp';
import { dbService } from '../../services/supabase';

interface InquiriesDeskProps {
  sessions: SessionRecord[];
  supportTickets: SupportTicket[];
  employees?: Employee[];
  bookings?: FreightBooking[];
  onUpdateSupportStatus: (userId: string, status: SupportTicket['status']) => void;
}

export const InquiriesDesk: React.FC<InquiriesDeskProps> = ({
  sessions,
  supportTickets,
  employees = [],
  bookings = [],
  onUpdateSupportStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sessions' | 'support'>('sessions');
  const [sessionFilter, setSessionFilter] = useState<
    'all' | 'active_window' | 'stage1_due' | 'stage2_due' | 'stage3_due' | 'expired_window'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Session assignments & reminders
  const [sessionAssignments, setSessionAssignments] = useState<Record<string, SessionAssignment>>({});
  const [reminderLogs, setReminderLogs] = useState<Record<string, SessionReminderLog>>({});
  const [isAutoEngineEnabled, setIsAutoEngineEnabled] = useState<boolean>(true);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);

  // Modal State
  const [modalSession, setModalSession] = useState<SessionRecord | null>(null);
  const [selectedStage, setSelectedStage] = useState<1 | 2 | 3>(1);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Set of completed user_ids and phones from freight bookings
  const completedKeys = useMemo(() => {
    const set = new Set<string>();
    (bookings || []).forEach((b) => {
      if (b.user_id) set.add(b.user_id);
      if (b.phone) {
        set.add(b.phone);
        const digits = b.phone.replace(/\D/g, '');
        set.add(digits);
        if (digits.length === 12 && digits.startsWith('91')) {
          set.add(digits.slice(2));
        }
      }
    });
    return set;
  }, [bookings]);

  // Pure Half-Way Drop-Off Leads only (Exclude completed orders, main menu idle, support)
  const halfWaySessions = useMemo(() => {
    return sessions.filter((s) => {
      const st = (s.state || '').toLowerCase();
      // Exclude terminal / completed / main menu / support states
      if (
        st === 'cta_menu' ||
        st === 'completed' ||
        st === 'cta_ai' ||
        st === 'cta_support' ||
        st === 'main_menu' ||
        st === 'support' ||
        st === 'support_flow'
      ) {
        return false;
      }

      // Exclude if already confirmed/completed in bookings
      if (completedKeys.has(s.user_id) || completedKeys.has(s.phone)) {
        return false;
      }
      const rawPhone = (s.phone || '').replace(/\D/g, '');
      if (completedKeys.has(rawPhone)) {
        return false;
      }
      if (rawPhone.length === 12 && rawPhone.startsWith('91') && completedKeys.has(rawPhone.slice(2))) {
        return false;
      }

      return true;
    });
  }, [sessions, completedKeys]);

  // Load assignments & reminder logs on mount
  useEffect(() => {
    const loadedAssignments = dbService.getLocalSessionAssignments();
    const loadedLogs = dbService.getLocalReminderLogs();
    setSessionAssignments(loadedAssignments);
    setReminderLogs(loadedLogs);

    // Auto-assign any half-way drop-off sessions that do not have an owner yet
    if (halfWaySessions.length > 0 && employees.length > 0) {
      const res = dbService.autoAssignSessions(halfWaySessions, employees);
      setSessionAssignments(res.assignments);
    }
  }, [halfWaySessions, employees]);

  // Clean phone number helper
  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  };

  // Format phone display (+91 XXXXX XXXXX)
  const formatPhoneDisplay = (phone?: string) => {
    if (!phone) return '—';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    if (clean.length === 12 && clean.startsWith('91')) {
      return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
    }
    return phone;
  };

  // Format date and time
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Relative time helper
  const getRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  // Calculate Meta 24-Hour Customer Service Window & elapsed hours
  const getWindowInfo = (updatedAt: string) => {
    try {
      const lastActiveTime = new Date(updatedAt).getTime();
      const now = Date.now();
      const elapsedHours = (now - lastActiveTime) / (1000 * 60 * 60);
      const remainingHours = 24 - elapsedHours;

      if (remainingHours > 0) {
        const h = Math.floor(remainingHours);
        const m = Math.floor((remainingHours - h) * 60);
        return {
          isOpen: true,
          elapsedHours,
          remainingHours,
          remainingText: `${h}h ${m}m left`,
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-500 animate-pulse',
          costText: 'FREE (₹0 Meta Fee)',
        };
      } else {
        const pastHours = Math.floor(Math.abs(remainingHours));
        return {
          isOpen: false,
          elapsedHours,
          remainingHours,
          remainingText: `Expired (${pastHours}h ago)`,
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
          dotClass: 'bg-rose-500',
          costText: 'Direct Call Required',
        };
      }
    } catch {
      return {
        isOpen: false,
        elapsedHours: 999,
        remainingHours: -999,
        remainingText: 'Unknown',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
        costText: '—',
      };
    }
  };

  // Check which stage is currently due for a session
  const getNextDueStage = (session: SessionRecord): 1 | 2 | 3 | null => {
    const win = getWindowInfo(session.updated_at);
    if (!win.isOpen) return null;

    const st = (session.state || '').toLowerCase();
    if (st === 'cta_menu' || st === 'completed' || st === 'support_flow') return null;

    const log: Partial<SessionReminderLog> = reminderLogs[session.user_id] || {};
    if (!log.r1_sent_at && win.elapsedHours >= 1) return 1;
    if (!log.r2_sent_at && win.elapsedHours >= 6) return 2;
    if (!log.r3_sent_at && win.elapsedHours >= 18) return 3;

    return null;
  };

  // Manual auto-assign trigger
  const handleAutoAssign = () => {
    if (employees.length === 0) {
      alert('Please add employees in the Team Management tab first.');
      return;
    }
    const res = dbService.autoAssignSessions(halfWaySessions, employees);
    setSessionAssignments({ ...res.assignments });
    setSuccessToast(`✓ Auto-assigned ${res.newlyAssignedCount} drop-off session(s) across active employees!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Assign individual session
  const handleAssignSingle = (userId: string, empId: string) => {
    const emp = employees.find((e) => e.employee_id === empId);
    if (!emp) return;
    const updated = dbService.setSessionAssignment(userId, emp.employee_id, emp.name);
    setSessionAssignments((prev) => ({ ...prev, [userId]: updated }));
  };

  // Open modal for a specific session and stage (only permitted inside 24h Meta window)
  const openReminderModal = (s: SessionRecord, stage: 1 | 2 | 3 = 1) => {
    const win = getWindowInfo(s.updated_at);
    if (!win.isOpen) {
      alert('The 24-hour Meta messaging window for this customer has expired. WhatsApp session reminders are disabled. Please use Direct Call.');
      return;
    }

    setModalSession(s);
    setSelectedStage(stage);
    setModalError(null);
    setIsSending(false);
    setIsCopied(false);

    if (stage === 1) {
      setCustomMessage(getReminder1Text(s.state));
    } else if (stage === 2) {
      setCustomMessage(getReminder2Text());
    } else {
      setCustomMessage(getReminder3Text());
    }
  };

  // Switch stage in modal
  const handleStageSelect = (stage: 1 | 2 | 3) => {
    setSelectedStage(stage);
    if (!modalSession) return;
    if (stage === 1) {
      setCustomMessage(getReminder1Text(modalSession.state));
    } else if (stage === 2) {
      setCustomMessage(getReminder2Text());
    } else {
      setCustomMessage(getReminder3Text());
    }
  };

  // Send reminder from modal
  const handleSendReminder = async () => {
    if (!modalSession) return;
    setIsSending(true);
    setModalError(null);

    const result = await sendReminderStage(
      modalSession.phone,
      selectedStage,
      modalSession.state,
      customMessage
    );

    setIsSending(false);

    if (result.success) {
      const updatedLog = dbService.saveReminderLog(modalSession.user_id, selectedStage, result.messageId);
      setReminderLogs((prev) => ({ ...prev, [modalSession.user_id]: updatedLog }));

      const stageNames = {
        1: 'Stage 1 (Half-way Step Nudge)',
        2: 'Stage 2 (Urgency Alert)',
        3: 'Stage 3 (Support Hotline Call Button)',
      };

      setSuccessToast(`✓ ${stageNames[selectedStage]} sent successfully to ${modalSession.phone}!`);
      setModalSession(null);
      setTimeout(() => setSuccessToast(null), 5000);
    } else {
      setModalError(result.error || 'Failed to send WhatsApp reminder via Meta Cloud API.');
    }
  };

  // Run automated auto-reminders check
  const handleRunAutoReminders = async () => {
    setIsAutoProcessing(true);
    let sentCount = 0;

    for (const s of halfWaySessions) {
      const stage = getNextDueStage(s);
      if (stage) {
        try {
          const res = await sendReminderStage(s.phone, stage, s.state);
          if (res.success) {
            const updated = dbService.saveReminderLog(s.user_id, stage, res.messageId);
            setReminderLogs((prev) => ({ ...prev, [s.user_id]: updated }));
            sentCount++;
          }
        } catch (e) {
          console.error(`Auto-reminder dispatch failed for ${s.phone}:`, e);
        }
      }
    }

    setIsAutoProcessing(false);
    setSuccessToast(
      sentCount > 0
        ? `✓ Auto-reminder engine dispatched ${sentCount} reminder(s) to eligible customers!`
        : '✓ Auto-reminder scan complete: No sessions are currently due for a nudge.'
    );
    setTimeout(() => setSuccessToast(null), 5000);
  };

  // Background interval for Auto-Reminder Engine
  useEffect(() => {
    if (!isAutoEngineEnabled) return;
    const interval = setInterval(() => {
      halfWaySessions.forEach((s) => {
        const stage = getNextDueStage(s);
        if (stage) {
          sendReminderStage(s.phone, stage, s.state)
            .then((res) => {
              if (res.success) {
                const updated = dbService.saveReminderLog(s.user_id, stage, res.messageId);
                setReminderLogs((prev) => ({ ...prev, [s.user_id]: updated }));
              }
            })
            .catch((e) => console.warn('Auto background reminder error:', e));
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [isAutoEngineEnabled, halfWaySessions, reminderLogs]);

  // Counts for KPI filter cards
  const activeWindowCount = halfWaySessions.filter((s) => getWindowInfo(s.updated_at).isOpen).length;
  const expiredWindowCount = halfWaySessions.length - activeWindowCount;
  const stage1DueCount = halfWaySessions.filter((s) => getNextDueStage(s) === 1).length;
  const stage2DueCount = halfWaySessions.filter((s) => getNextDueStage(s) === 2).length;
  const stage3DueCount = halfWaySessions.filter((s) => getNextDueStage(s) === 3).length;

  // Filtered session list with text search
  const filteredSessions = useMemo(() => {
    return halfWaySessions.filter((s) => {
      const info = getWindowInfo(s.updated_at);
      const due = getNextDueStage(s);

      // Card filter
      if (sessionFilter === 'active_window' && !info.isOpen) return false;
      if (sessionFilter === 'expired_window' && info.isOpen) return false;
      if (sessionFilter === 'stage1_due' && due !== 1) return false;
      if (sessionFilter === 'stage2_due' && due !== 2) return false;
      if (sessionFilter === 'stage3_due' && due !== 3) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const phone = (s.phone || '').toLowerCase();
        const state = (s.state || '').toLowerCase();
        const step = formatStateLabel(s.state).toLowerCase();
        const asgn = sessionAssignments[s.user_id];
        const empName = (asgn?.assigned_name || '').toLowerCase();
        const matches = phone.includes(q) || state.includes(q) || step.includes(q) || empName.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [halfWaySessions, sessionFilter, searchQuery, sessionAssignments]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* ======================================================== */}
      {/* 1. TOP CONTROL BAR (CLEAN & SYSTEMATIC) */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: View Tabs */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              activeSubTab === 'sessions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Drop-Off Recovery</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeSubTab === 'sessions' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {halfWaySessions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('support')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              activeSubTab === 'support'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Support Tickets</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeSubTab === 'support' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {supportTickets.length}
            </span>
          </button>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* How it works toggle */}
          <button
            onClick={() => setShowHowItWorks((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
            title="Toggle 3-stage reminder pipeline guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>How It Works</span>
          </button>

          {/* Auto-Assign */}
          <button
            onClick={handleAutoAssign}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
            title="Distribute unassigned drop-off leads among team members"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Auto-Assign</span>
          </button>

          {/* Run Reminders */}
          <button
            onClick={handleRunAutoReminders}
            disabled={isAutoProcessing}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-1.5 transition shadow-xs"
            title="Scan and send due reminders immediately"
          >
            {isAutoProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Run Due Reminders</span>
              </>
            )}
          </button>

          {/* Auto-Scheduler Toggle */}
          <button
            onClick={() => setIsAutoEngineEnabled(!isAutoEngineEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
              isAutoEngineEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isAutoEngineEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>Auto-Nudge: {isAutoEngineEnabled ? 'ON' : 'PAUSED'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Info Drawer: How 3-Stage Drop-Off Recovery Works */}
      {showHowItWorks && (
        <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl border border-slate-800 shadow-md text-xs space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>3-Stage Automated Drop-Off Recovery Workflow</span>
            </span>
            <button
              onClick={() => setShowHowItWorks(false)}
              className="text-slate-400 hover:text-white p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-300">
            When a customer stops answering the WhatsApp bot halfway before completing their booking, this engine automatically nudges them during Meta's free 24-hour window:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="font-bold text-blue-300 block">1️⃣ Stage 1 (~1-2h)</span>
              <span className="text-[11px] text-slate-300 mt-0.5 block">
                Friendly step progress follow-up asking if they want to complete their specific step.
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="font-bold text-amber-300 block">2️⃣ Stage 2 (~6-8h)</span>
              <span className="text-[11px] text-slate-300 mt-0.5 block">
                Urgency alert warning that truck availability on their route is filling up fast.
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="font-bold text-rose-300 block">3️⃣ Stage 3 (~18-22h)</span>
              <span className="text-[11px] text-slate-300 mt-0.5 block">
                Direct helpline offer with interactive buttons connecting directly to live operations.
              </span>
            </div>
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center space-x-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Nudges sent within 24 hours incur ₹0 Meta fee. After 24 hours, use the Direct Call button.</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: SUPPORT TICKETS DESK */}
      {/* ======================================================== */}
      {activeSubTab === 'support' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Direct Customer Inquiries & Help Tickets</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tickets triggered via WhatsApp bot menu helpline ({SUPPORT_PHONE_DISPLAY})
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {supportTickets.length} Tickets
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {supportTickets.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No active support tickets at this time.
              </div>
            ) : (
              supportTickets.map((t) => {
                const phone = cleanPhone(t.phone);
                return (
                  <div key={t.user_id} className="p-4 hover:bg-slate-50/50 transition flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {formatPhoneDisplay(phone) || t.user_id}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{t.message}</p>
                      <p className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateTime(t.updated_at)}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <a
                        href={`tel:${phone || SUPPORT_PHONE_DISPLAY}`}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 flex items-center space-x-1.5 transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                        <span>Direct Call</span>
                      </a>
                      {t.status !== 'resolved' ? (
                        <button
                          onClick={() => onUpdateSupportStatus(t.user_id, 'resolved')}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition flex items-center space-x-1 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Resolved</span>
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-bold flex items-center space-x-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Resolved</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: LIVE BOT DROP-OFF RECOVERY */}
      {/* ======================================================== */}
      {activeSubTab === 'sessions' && (
        <div className="space-y-4">
          {/* ======================================================== */}
          {/* 2. INTERACTIVE KPI FILTER CARDS (SINGLE SOURCE OF TRUTH) */}
          {/* ======================================================== */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Card 1: All Inquiries */}
            <button
              onClick={() => setSessionFilter('all')}
              className={`p-3.5 rounded-2xl text-left border transition cursor-pointer relative overflow-hidden ${
                sessionFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${sessionFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                  All Drop-Offs
                </span>
                <Layers className={`w-3.5 h-3.5 ${sessionFilter === 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
              </div>
              <div className="text-2xl font-black mt-1">{halfWaySessions.length}</div>
              <div className={`text-[10px] mt-0.5 ${sessionFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
                Total incomplete
              </div>
            </button>

            {/* Card 2: Active 24h Window */}
            <button
              onClick={() => setSessionFilter('active_window')}
              className={`p-3.5 rounded-2xl text-left border transition cursor-pointer relative overflow-hidden ${
                sessionFilter === 'active_window'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30'
                  : 'bg-emerald-50/60 text-emerald-950 border-emerald-200 hover:border-emerald-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${sessionFilter === 'active_window' ? 'text-emerald-200' : 'text-emerald-700'}`}>
                  Active 24h
                </span>
                <span className={`w-2 h-2 rounded-full ${sessionFilter === 'active_window' ? 'bg-emerald-300' : 'bg-emerald-500 animate-pulse'}`} />
              </div>
              <div className="text-2xl font-black mt-1 text-emerald-700 group-hover:text-emerald-800">
                <span className={sessionFilter === 'active_window' ? 'text-white' : 'text-emerald-700'}>
                  {activeWindowCount}
                </span>
              </div>
              <div className={`text-[10px] mt-0.5 ${sessionFilter === 'active_window' ? 'text-emerald-200' : 'text-emerald-600 font-medium'}`}>
                Free Meta Nudge
              </div>
            </button>

            {/* Card 3: Stage 1 Due */}
            <button
              onClick={() => setSessionFilter('stage1_due')}
              className={`p-3.5 rounded-2xl text-left border transition cursor-pointer relative overflow-hidden ${
                sessionFilter === 'stage1_due'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30'
                  : 'bg-blue-50/60 text-blue-950 border-blue-200 hover:border-blue-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${sessionFilter === 'stage1_due' ? 'text-blue-200' : 'text-blue-700'}`}>
                  Stage 1 Due
                </span>
                <span className={`text-xs font-bold ${sessionFilter === 'stage1_due' ? 'text-blue-200' : 'text-blue-500'}`}>
                  1️⃣
                </span>
              </div>
              <div className={`text-2xl font-black mt-1 ${sessionFilter === 'stage1_due' ? 'text-white' : 'text-blue-700'}`}>
                {stage1DueCount}
              </div>
              <div className={`text-[10px] mt-0.5 ${sessionFilter === 'stage1_due' ? 'text-blue-200' : 'text-blue-600 font-medium'}`}>
                Step follow-up (~1h)
              </div>
            </button>

            {/* Card 4: Stage 2 Due */}
            <button
              onClick={() => setSessionFilter('stage2_due')}
              className={`p-3.5 rounded-2xl text-left border transition cursor-pointer relative overflow-hidden ${
                sessionFilter === 'stage2_due'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/30'
                  : 'bg-amber-50/60 text-amber-950 border-amber-200 hover:border-amber-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${sessionFilter === 'stage2_due' ? 'text-amber-200' : 'text-amber-700'}`}>
                  Stage 2 Due
                </span>
                <span className={`text-xs font-bold ${sessionFilter === 'stage2_due' ? 'text-amber-200' : 'text-amber-500'}`}>
                  2️⃣
                </span>
              </div>
              <div className={`text-2xl font-black mt-1 ${sessionFilter === 'stage2_due' ? 'text-white' : 'text-amber-700'}`}>
                {stage2DueCount}
              </div>
              <div className={`text-[10px] mt-0.5 ${sessionFilter === 'stage2_due' ? 'text-amber-200' : 'text-amber-600 font-medium'}`}>
                Urgency alert (~6h)
              </div>
            </button>

            {/* Card 5: Stage 3 Due */}
            <button
              onClick={() => setSessionFilter('stage3_due')}
              className={`p-3.5 rounded-2xl text-left border transition cursor-pointer relative overflow-hidden ${
                sessionFilter === 'stage3_due'
                  ? 'bg-purple-700 text-white border-purple-700 shadow-md ring-2 ring-purple-500/30'
                  : 'bg-purple-50/60 text-purple-950 border-purple-200 hover:border-purple-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${sessionFilter === 'stage3_due' ? 'text-purple-200' : 'text-purple-700'}`}>
                  Stage 3 Due
                </span>
                <span className={`text-xs font-bold ${sessionFilter === 'stage3_due' ? 'text-purple-200' : 'text-purple-500'}`}>
                  3️⃣
                </span>
              </div>
              <div className={`text-2xl font-black mt-1 ${sessionFilter === 'stage3_due' ? 'text-white' : 'text-purple-700'}`}>
                {stage3DueCount}
              </div>
              <div className={`text-[10px] mt-0.5 ${sessionFilter === 'stage3_due' ? 'text-purple-200' : 'text-purple-600 font-medium'}`}>
                Call button (~18h)
              </div>
            </button>

            {/* Card 6: Expired Window */}
            <button
              onClick={() => setSessionFilter('expired_window')}
              className={`p-3.5 rounded-2xl text-left border transition cursor-pointer relative overflow-hidden ${
                sessionFilter === 'expired_window'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-md ring-2 ring-rose-500/30'
                  : 'bg-rose-50/60 text-rose-950 border-rose-200 hover:border-rose-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${sessionFilter === 'expired_window' ? 'text-rose-200' : 'text-rose-700'}`}>
                  Expired 24h
                </span>
                <PhoneCall className={`w-3.5 h-3.5 ${sessionFilter === 'expired_window' ? 'text-rose-200' : 'text-rose-500'}`} />
              </div>
              <div className={`text-2xl font-black mt-1 ${sessionFilter === 'expired_window' ? 'text-white' : 'text-rose-700'}`}>
                {expiredWindowCount}
              </div>
              <div className={`text-[10px] mt-0.5 ${sessionFilter === 'expired_window' ? 'text-rose-200' : 'text-rose-600 font-medium'}`}>
                Direct call only
              </div>
            </button>
          </div>

          {/* ======================================================== */}
          {/* 3. SEARCH & RESULTS HEADER */}
          {/* ======================================================== */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-800">
                {sessionFilter === 'all' && 'All Incomplete Drop-Offs'}
                {sessionFilter === 'active_window' && 'Customers in Active 24h Window (Free WhatsApp Nudge)'}
                {sessionFilter === 'stage1_due' && 'Stage 1 Follow-Up Due (~1h after stop)'}
                {sessionFilter === 'stage2_due' && 'Stage 2 Urgency Alert Due (~6h after stop)'}
                {sessionFilter === 'stage3_due' && 'Stage 3 Support Call Offer Due (~18h after stop)'}
                {sessionFilter === 'expired_window' && 'Expired 24h Window (Direct Voice Call Recommended)'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                ({filteredSessions.length} {filteredSessions.length === 1 ? 'chat' : 'chats'})
              </span>
            </div>

            {/* Instant Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone or step name..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* 4. SYSTEMATIC DROP-OFF CARDS LIST */}
          {/* ======================================================== */}
          <div className="space-y-3">
            {filteredSessions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400 shadow-xs">
                <Bot className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
                <p className="font-bold text-slate-700 text-sm">No drop-off sessions match this filter</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Try switching filter tabs or clearing your search query.
                </p>
              </div>
            ) : (
              filteredSessions.map((s) => {
                const phone = cleanPhone(s.phone);
                const windowInfo = getWindowInfo(s.updated_at);
                const assignment = sessionAssignments[s.user_id];
                const log: Partial<SessionReminderLog> = reminderLogs[s.user_id] || {};
                const nextDue = getNextDueStage(s);
                const stepLabel = formatStateLabel(s.state);

                return (
                  <div
                    key={s.user_id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition overflow-hidden"
                  >
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Customer & Drop-Off Checkpoint */}
                      <div className="space-y-2 min-w-0 flex-1">
                        {/* Row 1: Phone, Flow Badge, and Step */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {formatPhoneDisplay(phone)}
                          </span>

                          {/* Flow Type Badge */}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            {s.flow_type === 'provider' ? '🚚 Transporter Registration' : '📦 Freight Booking'}
                          </span>

                          {/* 24h Window Badge */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center space-x-1.5 ${windowInfo.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${windowInfo.dotClass}`} />
                            <span>{windowInfo.remainingText}</span>
                          </span>
                        </div>

                        {/* Row 2: Stopped at Checkpoint */}
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                          <span className="text-slate-400 font-medium">Stopped At:</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/60 inline-flex items-center space-x-1">
                            <span>{stepLabel}</span>
                          </span>
                        </div>

                        {/* Row 3: Meta Info (Assigned Specialist & Last Active Timestamp) */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                          {/* Clean Single Specialist Selector */}
                          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-slate-500 text-[11px]">Owner:</span>
                            {employees.length > 0 ? (
                              <select
                                value={assignment?.assigned_to || ''}
                                onChange={(e) => handleAssignSingle(s.user_id, e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                              >
                                <option value="" disabled className="text-slate-400">
                                  Assign specialist...
                                </option>
                                {employees
                                  .filter((e) => e.is_active)
                                  .map((emp) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                      {emp.name} ({emp.employee_id})
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <span className="font-bold text-slate-700">
                                {assignment?.assigned_name || 'Unassigned'}
                              </span>
                            )}
                          </div>

                          {/* Last Active Timestamp */}
                          <div className="flex items-center space-x-1 text-slate-400 text-xs">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Active: <strong className="text-slate-700">{formatDateTime(s.updated_at)}</strong> (
                              {getRelativeTime(s.updated_at)})
                            </span>
                          </div>
                        </div>

                        {/* Row 4: Active 24h Pipeline Progress (ONLY shown when inside active 24h window) */}
                        {windowInfo.isOpen && (
                          <div className="pt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                              3-Stage Recovery:
                            </span>

                            {/* Stage 1 Pill */}
                            <button
                              onClick={() => openReminderModal(s, 1)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition ${
                                log.r1_sent_at
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : nextDue === 1
                                  ? 'bg-blue-100 text-blue-900 border-blue-400 font-bold animate-pulse'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>① Step Nudge</span>
                              {log.r1_sent_at ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : nextDue === 1 ? (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-600 text-white font-bold">
                                  DUE
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-normal">~1h</span>
                              )}
                            </button>

                            <ArrowRight className="w-3 h-3 text-slate-300" />

                            {/* Stage 2 Pill */}
                            <button
                              onClick={() => openReminderModal(s, 2)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition ${
                                log.r2_sent_at
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : nextDue === 2
                                  ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold animate-pulse'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>② Urgency Alert</span>
                              {log.r2_sent_at ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : nextDue === 2 ? (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-600 text-white font-bold">
                                  DUE
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-normal">~6h</span>
                              )}
                            </button>

                            <ArrowRight className="w-3 h-3 text-slate-300" />

                            {/* Stage 3 Pill */}
                            <button
                              onClick={() => openReminderModal(s, 3)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition ${
                                log.r3_sent_at
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : nextDue === 3
                                  ? 'bg-rose-100 text-rose-900 border-rose-400 font-bold animate-pulse'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>③ Hotline Button</span>
                              {log.r3_sent_at ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : nextDue === 3 ? (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-600 text-white font-bold">
                                  DUE
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-normal">~18h</span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: Operational Recovery Action */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                        {/* CASE A: 24h Window is OPEN (WhatsApp Session Nudge + Call) */}
                        {windowInfo.isOpen ? (
                          <div className="flex items-center space-x-2">
                            <a
                              href={`tel:${phone}`}
                              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition"
                              title="Call customer directly"
                            >
                              <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                              <span>Call</span>
                            </a>

                            <button
                              onClick={() => openReminderModal(s, nextDue || 1)}
                              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>
                                {nextDue ? `Send Stage ${nextDue} Nudge` : 'Send Reminder...'}
                              </span>
                            </button>
                          </div>
                        ) : (
                          /* CASE B: 24h Window is EXPIRED (Voice Call Only) */
                          <div className="flex flex-col items-end space-y-1.5">
                            <a
                              href={`tel:${phone}`}
                              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition group"
                              title="Meta 24h window has passed — direct call customer to complete order"
                            >
                              <PhoneCall className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                              <span>Direct Voice Call</span>
                            </a>
                            <span className="text-[11px] text-slate-400 italic">
                              24h window closed • Call to recover
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. INTERACTIVE 3-STAGE REMINDER MODAL */}
      {/* ======================================================== */}
      {modalSession &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSending) {
                setModalSession(null);
                setModalError(null);
              }
            }}
          >
            <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Dispatch WhatsApp Reminder
                    </h3>
                    <p className="text-xs text-slate-500">
                      Customer: <span className="font-mono font-bold text-blue-700">{formatPhoneDisplay(modalSession.phone)}</span> •
                      Step: <strong className="text-slate-800">{formatStateLabel(modalSession.state)}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalSession(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Meta Service Window indicator */}
              {getWindowInfo(modalSession.updated_at).isOpen ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">24-Hour Customer Service Window is OPEN (FREE ₹0.00)</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Messages sent within this window incur zero Meta messaging fee.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">24-Hour Customer Service Window has EXPIRED</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Customer stopped texting over 24h ago. A direct phone call is recommended.
                    </p>
                  </div>
                </div>
              )}

              {/* 3-Stage Selector Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Reminder Stage:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStageSelect(1)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selectedStage === 1
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">1️⃣ Stage 1</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">Step Follow-Up</span>
                    <span className="text-[10px] text-blue-600 font-bold block mt-1">Schedule: ~1-2h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStageSelect(2)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selectedStage === 2
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">2️⃣ Stage 2</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">Urgency Alert</span>
                    <span className="text-[10px] text-amber-600 font-bold block mt-1">Schedule: ~6-8h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStageSelect(3)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selectedStage === 3
                        ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">3️⃣ Stage 3</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">Call Hotline Button</span>
                    <span className="text-[10px] text-purple-600 font-bold block mt-1">Schedule: ~18-22h</span>
                  </button>
                </div>
              </div>

              {/* Message Content & Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Message Body Preview (Editable)</span>
                  <span className="text-[11px] text-slate-400 font-normal">WhatsApp Format (*bold*, emojis)</span>
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-sans focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Stage 3 Special: Interactive Buttons Preview */}
              {selectedStage === 3 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                    <PhoneCall className="w-3.5 h-3.5 text-purple-600" />
                    <span>WhatsApp Cloud API Interactive Buttons (Included):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REMINDER_3_BUTTONS.map((btn) => (
                      <div
                        key={btn.id}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-semibold text-xs shadow-xs flex items-center space-x-1.5"
                      >
                        <span className="text-blue-600 font-bold">🔘</span>
                        <span>{btn.title}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Clicking <strong>'📞 Call Support'</strong> directs customer to your live operations line ({SUPPORT_PHONE_DISPLAY}).
                  </p>
                </div>
              )}

              {/* Error Alert */}
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Failed to dispatch WhatsApp reminder</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">{modalError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(customMessage);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium flex items-center space-x-1"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                <span>{isCopied ? 'Copied' : 'Copy Text'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setModalSession(null)}
                  disabled={isSending}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendReminder}
                  disabled={isSending}
                  className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50 ${
                    selectedStage === 1
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : selectedStage === 2
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Stage {selectedStage} Reminder</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs font-semibold animate-in slide-in-from-bottom duration-200 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  );
};
