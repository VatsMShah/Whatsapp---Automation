import React, { useState, useEffect } from 'react';
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
  Flame,
  PhoneOutgoing,
  Bot,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { SessionRecord, SupportTicket, Employee, SessionAssignment, SessionReminderLog, FreightBooking } from '../../types';
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
  const [activeSubTab, setActiveSubTab] = useState<'support' | 'sessions'>('sessions');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'active_window' | 'stage1_due' | 'stage2_due' | 'stage3_due' | 'expired_window'>('all');

  // Session assignments & reminders
  const [sessionAssignments, setSessionAssignments] = useState<Record<string, SessionAssignment>>({});
  const [reminderLogs, setReminderLogs] = useState<Record<string, SessionReminderLog>>({});
  const [isAutoEngineEnabled, setIsAutoEngineEnabled] = useState<boolean>(true);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);

  // Set of completed user_ids and phones from freight bookings
  const completedKeys = React.useMemo(() => {
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
  const halfWaySessions = React.useMemo(() => {
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

  // Modal State
  const [modalSession, setModalSession] = useState<SessionRecord | null>(null);
  const [selectedStage, setSelectedStage] = useState<1 | 2 | 3>(1);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

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
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          dotClass: 'bg-rose-500',
          costText: 'Direct Call / ~₹0.15 Template',
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

    // Exclude completed or support states
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

  // Open modal for a specific session and stage
  const openReminderModal = (s: SessionRecord, stage: 1 | 2 | 3 = 1) => {
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
        1: 'Stage 1 (Half-way Step)',
        2: 'Stage 2 (Attention Grabbing Urgency)',
        3: 'Stage 3 (Support Call Button)',
      };

      setSuccessToast(`✓ ${stageNames[selectedStage]} successfully sent to ${modalSession.phone}!`);
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
        ? `✓ Auto-reminder engine processed: ${sentCount} reminder(s) dispatched to eligible users!`
        : '✓ Auto-reminder scan complete: All sessions are up to date within their 24h schedule.'
    );
    setTimeout(() => setSuccessToast(null), 5000);
  };

  // Background interval for Auto-Reminder Engine
  useEffect(() => {
    if (!isAutoEngineEnabled) return;
    const interval = setInterval(() => {
      // Evaluate due reminders
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
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [isAutoEngineEnabled, halfWaySessions, reminderLogs]);

  // Counts for filters
  const activeWindowCount = halfWaySessions.filter((s) => getWindowInfo(s.updated_at).isOpen).length;
  const expiredWindowCount = halfWaySessions.length - activeWindowCount;
  const stage1DueCount = halfWaySessions.filter((s) => getNextDueStage(s) === 1).length;
  const stage2DueCount = halfWaySessions.filter((s) => getNextDueStage(s) === 2).length;
  const stage3DueCount = halfWaySessions.filter((s) => getNextDueStage(s) === 3).length;

  // Filtered session list
  const filteredSessions = halfWaySessions.filter((s) => {
    const info = getWindowInfo(s.updated_at);
    const due = getNextDueStage(s);
    if (sessionFilter === 'active_window') return info.isOpen;
    if (sessionFilter === 'expired_window') return !info.isOpen;
    if (sessionFilter === 'stage1_due') return due === 1;
    if (sessionFilter === 'stage2_due') return due === 2;
    if (sessionFilter === 'stage3_due') return due === 3;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Sub Navigation Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`px-3.5 py-2 rounded-lg font-medium flex items-center space-x-2 transition ${
              activeSubTab === 'sessions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Live Bot Drop-Off Recovery (3-Stage Auto Reminders)</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeSubTab === 'sessions' ? 'bg-blue-700/60 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {halfWaySessions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('support')}
            className={`px-3.5 py-2 rounded-lg font-medium flex items-center space-x-2 transition ${
              activeSubTab === 'support'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Direct Support Tickets</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeSubTab === 'support' ? 'bg-blue-700/60 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {supportTickets.length}
            </span>
          </button>
        </div>

        {/* Protection & Support Status */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Meta 24h Free Customer Service Window Active</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SUPPORT TICKETS DESK */}
      {/* ======================================================== */}
      {activeSubTab === 'support' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Direct Customer Inquiries & Help Desk</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Support tickets triggered via WhatsApp bot menu (Helpline: {SUPPORT_PHONE_DISPLAY})
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {supportTickets.length} Tickets Recorded
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
                        <span className="font-mono font-semibold text-slate-900 text-xs">{phone || t.user_id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{t.message}</p>
                      <p className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateTime(t.updated_at)}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <a
                        href={`tel:${phone || SUPPORT_PHONE_DISPLAY}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-300 flex items-center space-x-1.5 transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                        <span>Direct Call</span>
                      </a>
                      {t.status !== 'resolved' ? (
                        <button
                          onClick={() => onUpdateSupportStatus(t.user_id, 'resolved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Resolved</span>
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
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
      {/* TAB 2: LIVE BOT SESSIONS & 3-STAGE AUTO REMINDER ENGINE */}
      {/* ======================================================== */}
      {activeSubTab === 'sessions' && (
        <div className="space-y-4">
          {/* Top Engine Banner: Auto-Assign & 3-Stage 24h Window Explanation */}
          <div className="p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl text-white shadow-md border border-blue-800/40 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-200 text-[10px] font-bold tracking-wider uppercase border border-blue-400/30">
                  Automated Drop-Off Recovery Engine
                </span>
                <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>3-Stage Reminder System Active</span>
                </span>
              </div>
              <h2 className="text-base font-bold text-white">
                Auto-Assign & 3-Stage 24-Hour WhatsApp Reminder Engine
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Automatically nudges customers who stopped halfway before completing order:{' '}
                <strong className="text-blue-300">1️⃣ Step Progress Follow-Up</strong> (~1-2h),{' '}
                <strong className="text-amber-300">2️⃣ High Urgency Route Alert</strong> (~6-8h), and{' '}
                <strong className="text-rose-300">3️⃣ Direct Support Call Option Button</strong> (~18-22h).
              </p>
            </div>

            {/* Automation Controls */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={handleAutoAssign}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs flex items-center space-x-1.5 transition shadow-sm"
                title="Equally distribute all unassigned drop-off leads among active team members"
              >
                <Users className="w-3.5 h-3.5 text-blue-300" />
                <span>Auto-Assign Team Members</span>
              </button>

              <button
                onClick={handleRunAutoReminders}
                disabled={isAutoProcessing}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 transition shadow-md"
              >
                {isAutoProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Engine...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Run Auto-Reminders Now</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsAutoEngineEnabled(!isAutoEngineEnabled)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
                  isAutoEngineEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isAutoEngineEnabled ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>Auto-Scheduler: {isAutoEngineEnabled ? 'ON' : 'PAUSED'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500">Total Half-Way Chats</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{halfWaySessions.length}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-medium text-emerald-800">In 24h Window (Free)</span>
              <p className="text-xl font-bold text-emerald-700 mt-1">{activeWindowCount}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 shadow-xs">
              <span className="text-[11px] font-medium text-blue-800">Stage 1 Due (Step Nudge)</span>
              <p className="text-xl font-bold text-blue-700 mt-1">{stage1DueCount}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 shadow-xs">
              <span className="text-[11px] font-medium text-amber-800">Stage 2 Due (Urgency)</span>
              <p className="text-xl font-bold text-amber-700 mt-1">{stage2DueCount}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 shadow-xs">
              <span className="text-[11px] font-medium text-rose-800">Stage 3 Due (Support Call)</span>
              <p className="text-xl font-bold text-rose-700 mt-1">{stage3DueCount}</p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium mr-1">Filter Chats:</span>
              <button
                onClick={() => setSessionFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  sessionFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({halfWaySessions.length})
              </button>
              <button
                onClick={() => setSessionFilter('active_window')}
                className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center space-x-1 ${
                  sessionFilter === 'active_window'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Active 24h ({activeWindowCount})</span>
              </button>
              <button
                onClick={() => setSessionFilter('stage1_due')}
                className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center space-x-1 ${
                  sessionFilter === 'stage1_due'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <span>Stage 1 Due ({stage1DueCount})</span>
              </button>
              <button
                onClick={() => setSessionFilter('stage2_due')}
                className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center space-x-1 ${
                  sessionFilter === 'stage2_due'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span>Stage 2 Due ({stage2DueCount})</span>
              </button>
              <button
                onClick={() => setSessionFilter('stage3_due')}
                className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center space-x-1 ${
                  sessionFilter === 'stage3_due'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <span>Stage 3 Due ({stage3DueCount})</span>
              </button>
              <button
                onClick={() => setSessionFilter('expired_window')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  sessionFilter === 'expired_window'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                Expired Window ({expiredWindowCount})
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              <span>Nudges within 24h incur ₹0.00 Meta fee.</span>
            </div>
          </div>

          {/* Sessions List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filteredSessions.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <Bot className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No sessions match the selected filter.
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
                      className="p-4 hover:bg-slate-50/60 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Left: Customer & Flow State Context */}
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Customer Phone */}
                          <span className="font-mono font-bold text-slate-900 text-sm">{phone}</span>

                          {/* Current Drop-Off Step */}
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                            <span className="text-slate-400 font-normal">Step:</span>
                            <span>{stepLabel}</span>
                          </span>

                          {/* Flow Type */}
                          {s.flow_type && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                              {s.flow_type}
                            </span>
                          )}

                          {/* 24h Window Badge */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center space-x-1.5 ${windowInfo.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${windowInfo.dotClass}`} />
                            <span>{windowInfo.remainingText}</span>
                            <span className="text-[10px] opacity-75">({windowInfo.costText})</span>
                          </span>
                        </div>

                        {/* Middle Meta Info: Assignment & Timestamp */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          {/* Assigned Employee */}
                          <div className="flex items-center space-x-1.5 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200">
                            <User className="w-3 h-3 text-slate-500" />
                            <span>Assigned to:</span>
                            {assignment ? (
                              <strong className="text-slate-800 font-semibold">
                                {assignment.assigned_name} ({assignment.assigned_to})
                              </strong>
                            ) : (
                              <span className="text-amber-600 italic">Unassigned</span>
                            )}

                            {/* Quick Reassign dropdown */}
                            {employees.length > 0 && (
                              <select
                                value={assignment?.assigned_to || ''}
                                onChange={(e) => handleAssignSingle(s.user_id, e.target.value)}
                                className="ml-1 bg-transparent text-[11px] text-blue-600 font-medium focus:outline-none cursor-pointer"
                              >
                                <option value="" disabled>
                                  Transfer...
                                </option>
                                {employees
                                  .filter((e) => e.is_active)
                                  .map((emp) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                      {emp.name} ({emp.employee_id})
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>

                          {/* Last customer message */}
                          <div className="flex items-center space-x-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>
                              Last active: <strong className="text-slate-700">{formatDateTime(s.updated_at)}</strong> (
                              {getRelativeTime(s.updated_at)})
                            </span>
                          </div>
                        </div>

                        {/* 3-Stage Progress Pipeline Indicator */}
                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            3-Stage 24h Pipeline:
                          </span>

                          {/* Stage 1 Pill */}
                          <div
                            onClick={() => openReminderModal(s, 1)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center space-x-1.5 cursor-pointer transition ${
                              log.r1_sent_at
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : nextDue === 1
                                ? 'bg-blue-100 text-blue-900 border-blue-400 font-bold animate-pulse'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                            title={log.r1_sent_at ? `Sent at ${formatDateTime(log.r1_sent_at)}` : 'Click to preview & send'}
                          >
                            <span>1️⃣ Step Follow-Up</span>
                            {log.r1_sent_at ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : nextDue === 1 ? (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-blue-600 text-white font-bold">DUE</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">~1h</span>
                            )}
                          </div>

                          <ChevronRight className="w-3 h-3 text-slate-300" />

                          {/* Stage 2 Pill */}
                          <div
                            onClick={() => openReminderModal(s, 2)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center space-x-1.5 cursor-pointer transition ${
                              log.r2_sent_at
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : nextDue === 2
                                ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold animate-pulse'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                            title={log.r2_sent_at ? `Sent at ${formatDateTime(log.r2_sent_at)}` : 'Click to preview & send'}
                          >
                            <span>2️⃣ Urgency Alert</span>
                            {log.r2_sent_at ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : nextDue === 2 ? (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-amber-600 text-white font-bold">DUE</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">~6h</span>
                            )}
                          </div>

                          <ChevronRight className="w-3 h-3 text-slate-300" />

                          {/* Stage 3 Pill */}
                          <div
                            onClick={() => openReminderModal(s, 3)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center space-x-1.5 cursor-pointer transition ${
                              log.r3_sent_at
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : nextDue === 3
                                ? 'bg-rose-100 text-rose-900 border-rose-400 font-bold animate-pulse'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                            title={log.r3_sent_at ? `Sent at ${formatDateTime(log.r3_sent_at)}` : 'Click to preview & send'}
                          >
                            <span>3️⃣ Support Call Button</span>
                            {log.r3_sent_at ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : nextDue === 3 ? (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-rose-600 text-white font-bold">DUE</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">~18h</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Operational Actions */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Direct Voice Call */}
                        <a
                          href={`tel:${phone}`}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-300 transition shadow-xs"
                          title="Call directly from phone"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                          <span>Direct Call</span>
                        </a>

                        {/* Send Stage Reminder Button */}
                        <button
                          onClick={() => openReminderModal(s, nextDue || 1)}
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {nextDue ? `Send Stage ${nextDue} Reminder` : 'Send Reminder...'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* INTERACTIVE 3-STAGE REMINDER MODAL */}
      {/* ======================================================== */}
      {modalSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Auto-Assign 3-Stage Reminder Dispatcher
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customer: <span className="font-mono font-semibold text-blue-600">{modalSession.phone}</span> •
                    Drop-off Step: <strong className="text-slate-800">{formatStateLabel(modalSession.state)}</strong>
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
                      Messages and interactive buttons sent within this window incur zero Meta messaging fee.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">24-Hour Customer Service Window has EXPIRED</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Customer stopped texting more than 24h ago. A direct phone call is strongly recommended.
                    </p>
                  </div>
                </div>
              )}

              {/* 3-Stage Selector Tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Reminder Stage to Dispatch:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStageSelect(1)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      selectedStage === 1
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">1️⃣ Stage 1</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">Half-Way Step Nudge</span>
                    <span className="text-[10px] text-blue-600 font-semibold block mt-1">Schedule: ~1-2h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStageSelect(2)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      selectedStage === 2
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">2️⃣ Stage 2</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">High Urgency Alert</span>
                    <span className="text-[10px] text-amber-600 font-semibold block mt-1">Schedule: ~6-8h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStageSelect(3)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      selectedStage === 3
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">3️⃣ Stage 3</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">Support Call Button</span>
                    <span className="text-[10px] text-rose-600 font-semibold block mt-1">Schedule: ~18-22h</span>
                  </button>
                </div>
              </div>

              {/* Message Content & Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
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
                    <PhoneOutgoing className="w-3.5 h-3.5 text-rose-600" />
                    <span>WhatsApp Cloud API Interactive Option Buttons (Included):</span>
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
                    Clicking <strong>'📞 Call Support'</strong> directs customer to live operations line ({SUPPORT_PHONE_DISPLAY}) with instant hotline response.
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
                  className={`px-4 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50 ${
                    selectedStage === 1
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : selectedStage === 2
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending via Meta API...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Stage {selectedStage} Reminder Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
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
