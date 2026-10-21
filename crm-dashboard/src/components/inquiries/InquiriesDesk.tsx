import React, { useState } from 'react';
import {
  MessageSquare,
  LifeBuoy,
  Phone,
  PhoneCall,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  User,
  ArrowRight,
  Sparkles,
  Send,
  X,
  Info,
  ShieldCheck,
  Check,
  Loader2,
} from 'lucide-react';
import { SessionRecord, SupportTicket } from '../../types';
import { sendWhatsAppNudge } from '../../services/whatsapp';

interface InquiriesDeskProps {
  sessions: SessionRecord[];
  supportTickets: SupportTicket[];
  onUpdateSupportStatus: (userId: string, status: SupportTicket['status']) => void;
}

export const InquiriesDesk: React.FC<InquiriesDeskProps> = ({
  sessions,
  supportTickets,
  onUpdateSupportStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'support' | 'sessions'>('support');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'active_window' | 'expired_window'>('all');
  const [nudgeModalSession, setNudgeModalSession] = useState<SessionRecord | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState<string>('');
  const [sentNudges, setSentNudges] = useState<Record<string, string>>({});
  const [isCopied, setIsCopied] = useState(false);
  const [isSendingNudge, setIsSendingNudge] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [nudgeSuccessToast, setNudgeSuccessToast] = useState<string | null>(null);

  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  };

  const formatStateLabel = (state: string) => {
    if (!state) return 'Starting';
    return state
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
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

  // Calculate Meta 24-Hour Customer Service Window
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
          remainingText: `${h}h ${m}m left`,
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClass: 'bg-emerald-500 animate-pulse',
          costText: 'FREE (₹0 Meta Fee)',
        };
      } else {
        const pastHours = Math.floor(Math.abs(remainingHours));
        return {
          isOpen: false,
          remainingText: `Expired (${pastHours}h ago)`,
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          dotClass: 'bg-rose-500',
          costText: 'Direct Call / ~₹0.15 Template',
        };
      }
    } catch {
      return {
        isOpen: false,
        remainingText: 'Unknown',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
        costText: '—',
      };
    }
  };

  const openNudgeModal = (s: SessionRecord) => {
    setNudgeModalSession(s);
    setNudgeError(null);
    setIsSendingNudge(false);
    setNudgeMessage(
      `Hello! We noticed you started a freight booking on Traket WhatsApp (at Step: ${formatStateLabel(
        s.state
      )}). Can our operations team help you complete your booking? Reply 1 to continue.`
    );
    setIsCopied(false);
  };

  const handleConfirmNudge = async () => {
    if (!nudgeModalSession) return;
    setIsSendingNudge(true);
    setNudgeError(null);

    const result = await sendWhatsAppNudge(nudgeModalSession.phone, nudgeMessage);
    setIsSendingNudge(false);

    if (result.success) {
      const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      setSentNudges((prev) => ({
        ...prev,
        [nudgeModalSession.user_id]: nowTime,
      }));
      setNudgeModalSession(null);
      setNudgeSuccessToast(`✓ Nudge successfully sent to ${nudgeModalSession.phone} from Traket WhatsApp!`);
      setTimeout(() => setNudgeSuccessToast(null), 5000);
    } else {
      setNudgeError(result.error || 'Failed to send WhatsApp message via Meta Cloud API.');
    }
  };

  // Filter sessions
  const activeWindowCount = sessions.filter((s) => getWindowInfo(s.updated_at).isOpen).length;
  const expiredWindowCount = sessions.length - activeWindowCount;

  const filteredSessions = sessions.filter((s) => {
    const info = getWindowInfo(s.updated_at);
    if (sessionFilter === 'active_window') return info.isOpen;
    if (sessionFilter === 'expired_window') return !info.isOpen;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Sub navigation bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setActiveSubTab('support')}
            className={`px-3.5 py-2 rounded-lg font-medium flex items-center space-x-2 transition ${
              activeSubTab === 'support'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Support Requests</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeSubTab === 'support' ? 'bg-blue-700/60 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {supportTickets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`px-3.5 py-2 rounded-lg font-medium flex items-center space-x-2 transition ${
              activeSubTab === 'sessions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Live Bot Sessions (Drop-Off Recovery)</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeSubTab === 'sessions' ? 'bg-blue-700/60 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {sessions.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 hidden sm:flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Meta 24h Customer Service Window Protection Active</span>
        </div>
      </div>

      {/* Subtab 1: Support Tickets */}
      {activeSubTab === 'support' && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900">Direct Support Inquiries</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Assistance requests submitted directly by customers on WhatsApp
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {supportTickets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <LifeBuoy className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No open support tickets</p>
                <p className="text-slate-500 mt-1">
                  When a customer selects "Support" on WhatsApp, their ticket appears here.
                </p>
              </div>
            ) : (
              supportTickets.map((t) => {
                const phone = cleanPhone(t.phone);
                const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(
                  `Hello ${t.contact_name || ''}! We received your support request on Traket WhatsApp. How can we help you today?`
                )}`;
                return (
                  <div
                    key={t.user_id}
                    className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">{t.contact_name || t.phone || 'Customer'}</span>
                        <span className="text-[11px] font-mono font-medium text-blue-600">{t.phone}</span>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                            t.status === 'open'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : t.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-800 font-medium">{t.subject}</div>
                      <div className="text-[12px] text-slate-600 line-clamp-2">{t.message}</div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <select
                        value={t.status}
                        onChange={(e) =>
                          onUpdateSupportStatus(t.user_id, e.target.value as SupportTicket['status'])
                        }
                        className="bg-white border border-slate-300 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>

                      {t.phone && (
                        <div className="flex items-center space-x-1.5">
                          <a
                            href={`tel:${phone}`}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-300 transition"
                            title="Direct voice call"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-600" />
                            <span>Call</span>
                          </a>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition"
                          >
                            <span>WhatsApp</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Subtab 2: Live Bot Sessions with 24-Hour Window System */}
      {activeSubTab === 'sessions' && (
        <div className="space-y-4">
          {/* 24-Hour Window Explanation & Filter Toolbar */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500 font-medium mr-1">Filter Sessions:</span>
              <button
                onClick={() => setSessionFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                  sessionFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <span>All Sessions</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {sessions.length}
                </span>
              </button>

              <button
                onClick={() => setSessionFilter('active_window')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                  sessionFilter === 'active_window'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active 24h Window (Free Nudge)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/60 text-emerald-900 font-bold">
                  {activeWindowCount}
                </span>
              </button>

              <button
                onClick={() => setSessionFilter('expired_window')}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                  sessionFilter === 'expired_window'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Expired Window (Call Customer)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-200/60 text-rose-900 font-bold">
                  {expiredWindowCount}
                </span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              <span>Nudges within 24h of customer text incur <strong>₹0.00 Meta fee</strong>.</span>
            </div>
          </div>

          {/* Sessions List */}
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Live Conversation Sessions & Drop-Off Recovery
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customers who initiated a chat with the bot and may need assistance to complete their order
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No sessions match this filter</p>
                  <p className="text-slate-500 mt-1">
                    Users interacting with the WhatsApp bot will be listed here.
                  </p>
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const phone = cleanPhone(s.phone);
                  const windowInfo = getWindowInfo(s.updated_at);
                  const relativeTime = getRelativeTime(s.updated_at);
                  const exactTime = formatDateTime(s.updated_at);
                  const wasNudgeSent = sentNudges[s.user_id];

                  return (
                    <div
                      key={s.user_id}
                      className="p-4 hover:bg-slate-50/80 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                    >
                      {/* Left: Customer Info, Step, and Exact Timestamp */}
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-blue-600 font-bold text-sm">{s.phone}</span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                            Step: <strong className="text-slate-900">{formatStateLabel(s.state)}</strong>
                          </span>
                          {s.flow_type && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold uppercase">
                              {s.flow_type}
                            </span>
                          )}

                          {/* 24-Hour Service Window Status Pill */}
                          <div
                            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${windowInfo.badgeClass}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${windowInfo.dotClass}`}></span>
                            <span>{windowInfo.remainingText}</span>
                            <span className="text-[10px] opacity-75">({windowInfo.costText})</span>
                          </div>

                          {wasNudgeSent && (
                            <span className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Nudge Sent ({wasNudgeSent})</span>
                            </span>
                          )}
                        </div>

                        {/* Date and Time when customer stopped texting */}
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Last customer message: <strong className="text-slate-700">{exactTime}</strong>
                            </span>
                            <span className="text-slate-400">({relativeTime})</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Operational Actions */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Action 1: Direct Voice Call (Always Free & Instant) */}
                        <a
                          href={`tel:${phone}`}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-300 transition shadow-sm"
                          title="Call directly from phone"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                          <span>Direct Call</span>
                        </a>

                        {/* Action 2: Send Bot Nudge (Recommended if within 24h) */}
                        {windowInfo.isOpen ? (
                          <button
                            onClick={() => openNudgeModal(s)}
                            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Send Free Bot Nudge</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => openNudgeModal(s)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-medium text-xs transition"
                            title="24h window closed — template message required"
                          >
                            <Send className="w-3 h-3 text-amber-600" />
                            <span>Send Follow-Up (~₹0.15)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Nudge Preview & Send Modal */}
      {nudgeModalSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Follow-Up & Bot Recovery Nudge</h3>
                  <p className="text-xs text-slate-500">
                    Recipient: <span className="font-mono font-semibold text-blue-600">{nudgeModalSession.phone}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNudgeModalSession(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Service Window & Cost Indicator Card */}
              {getWindowInfo(nudgeModalSession.updated_at).isOpen ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">24-Hour Customer Service Window is ACTIVE</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Meta Cost: <strong>₹0.00 (Zero Fee)</strong>. This nudge will be sent within the active window without opening a new paid session.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">24-Hour Customer Service Window has EXPIRED</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      More than 24 hours have passed since the customer's last message. Meta requires a Utility Template (~₹0.15 fee) or a direct phone call.
                    </p>
                  </div>
                </div>
              )}

              {/* Customer Drop-off Context */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">Drop-Off Step:</span>
                  <p className="font-semibold text-slate-800">{formatStateLabel(nudgeModalSession.state)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Last Active Date:</span>
                  <p className="font-semibold text-slate-800">{formatDateTime(nudgeModalSession.updated_at)}</p>
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nudge Message Preview
                </label>
                <textarea
                  value={nudgeMessage}
                  onChange={(e) => setNudgeMessage(e.target.value)}
                  rows={4}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              {/* Error Alert if sending failed */}
              {nudgeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Failed to send WhatsApp nudge</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">{nudgeError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(nudgeMessage);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium flex items-center space-x-1"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                <span>{isCopied ? 'Copied' : 'Copy Message'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setNudgeModalSession(null)}
                  disabled={isSendingNudge}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmNudge}
                  disabled={isSendingNudge}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
                >
                  {isSendingNudge ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending via WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Nudge Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {nudgeSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{nudgeSuccessToast}</span>
        </div>
      )}
    </div>
  );
};

