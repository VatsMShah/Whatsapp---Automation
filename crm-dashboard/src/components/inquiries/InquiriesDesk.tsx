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
} from 'lucide-react';
import { SessionRecord, SupportTicket } from '../../types';

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

  return (
    <div className="space-y-5">
      {/* Sub navigation bar */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setActiveSubTab('support')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${
              activeSubTab === 'support'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Support Requests</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'support' ? 'bg-white/20' : 'bg-slate-800'
              }`}
            >
              {supportTickets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition ${
              activeSubTab === 'sessions'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Live Bot Sessions (Drop-Off Recovery)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'sessions' ? 'bg-white/20' : 'bg-slate-800'
              }`}
            >
              {sessions.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:block">
          Click any WhatsApp button to directly chat with the customer
        </div>
      </div>

      {/* Subtab 1: Support Tickets */}
      {activeSubTab === 'support' && (
        <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-white">Direct Support Inquiries</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Assistance requests submitted directly by customers on WhatsApp
            </p>
          </div>

          <div className="divide-y divide-slate-800/60">
            {supportTickets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <LifeBuoy className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="font-semibold text-slate-300">No open support tickets</p>
                <p className="text-slate-400 mt-1">
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
                    className="p-4 hover:bg-slate-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{t.contact_name || t.phone || 'Customer'}</span>
                        <span className="text-[10px] font-mono text-emerald-400">{t.phone}</span>
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            t.status === 'open'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-2">{t.message}</div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <select
                        value={t.status}
                        onChange={(e) =>
                          onUpdateSupportStatus(t.user_id, e.target.value as SupportTicket['status'])
                        }
                        className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>

                      {t.phone && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition"
                        >
                          <span>WhatsApp</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Subtab 2: Live Bot Sessions */}
      {activeSubTab === 'sessions' && (
        <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800/80">
            <h3 className="text-sm font-bold text-white">Live Conversation Sessions (Drop-Off Recovery)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Customers currently chatting with the WhatsApp bot or paused mid-booking
            </p>
          </div>

          <div className="divide-y divide-slate-800/60">
            {sessions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="font-semibold text-slate-300">No active bot sessions</p>
                <p className="text-slate-400 mt-1">Users talking to the bot will be listed here.</p>
              </div>
            ) : (
              sessions.map((s) => {
                const phone = cleanPhone(s.phone);
                const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(
                  `Hello! We noticed you were in the middle of booking freight on Traket WhatsApp. Can our dispatch team help you complete your order?`
                )}`;

                return (
                  <div
                    key={s.user_id}
                    className="p-4 hover:bg-slate-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-emerald-400 font-semibold">{s.phone}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                          Step: {formatStateLabel(s.state)}
                        </span>
                        {s.flow_type && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            {s.flow_type}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Last active: {new Date(s.updated_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition"
                      >
                        <span>Resume on WhatsApp</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
