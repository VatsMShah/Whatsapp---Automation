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

        <div className="text-[11px] text-slate-500 hidden sm:block">
          Click any WhatsApp button to directly chat with the customer
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
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition"
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
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900">Live Conversation Sessions (Drop-Off Recovery)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customers currently chatting with the WhatsApp bot or paused mid-booking
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {sessions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No active bot sessions</p>
                <p className="text-slate-500 mt-1">Users talking to the bot will be listed here.</p>
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
                    className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-blue-600 font-semibold">{s.phone}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                          Step: {formatStateLabel(s.state)}
                        </span>
                        {s.flow_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                            {s.flow_type}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Last active: {new Date(s.updated_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition"
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
