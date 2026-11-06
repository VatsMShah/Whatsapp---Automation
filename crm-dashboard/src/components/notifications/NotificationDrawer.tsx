import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Bell,
  Clock,
  MapPin,
  Truck,
  Phone,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Flame,
  Check,
  CheckCheck,
  Eye,
  Sparkles,
} from 'lucide-react';
import { LeadNotification } from '../../types';
import {
  isAudioMuted,
  setAudioMuted,
  isVoiceNotificationEnabled,
  setVoiceEnabled,
  playDispatchChime,
  speakLeadAnnouncement,
} from '../../utils/sound';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: LeadNotification[];
  onOpenLead: (bookingId: string) => void;
  onDismiss: (notificationId: string) => void;
  onClearAll: () => void;
  onMarkAllSeen?: () => void;
  onMarkSeen?: (notificationId: string) => void;
  onTriggerTestAlert?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onOpenLead,
  onDismiss,
  onClearAll,
  onMarkAllSeen,
  onMarkSeen,
  onTriggerTestAlert,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'viewed'>('all');
  const [muted, setMuted] = useState<boolean>(() => isAudioMuted());
  const [voiceEnabled, setVoiceState] = useState<boolean>(() => isVoiceNotificationEnabled());
  const [browserPermission, setBrowserPermission] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceState(next);
    setVoiceEnabled(next);
  };

  const requestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setBrowserPermission(res);
      } catch (e) {
        console.warn('Failed to request notification permission:', e);
      }
    }
  };

  const testAlert = () => {
    if (onTriggerTestAlert) {
      onTriggerTestAlert();
      onClose();
    } else {
      playDispatchChime();
      speakLeadAnnouncement('Test lead alert: Mumbai to Ahmedabad truck inquiry.');
    }
  };

  const pendingCount = notifications.filter((n) => n.status === 'pending').length;
  const viewedCount = notifications.filter((n) => n.status === 'viewed').length;

  const displayedList = notifications.filter((n) => {
    if (filterTab === 'pending') return n.status === 'pending';
    if (filterTab === 'viewed') return n.status === 'viewed';
    return true;
  });

  const getTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      return `${hours}h ${mins % 60}m ago`;
    } catch {
      return 'Recently';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden animate-in fade-in duration-200">
      {/* 100% Backdrop with Full-Screen Blur */}
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white text-slate-900 shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-black tracking-tight text-white">Lead Notifications</h3>
                  {pendingCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                      {pendingCount} Pending
                    </span>
                  ) : notifications.length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      All Attended
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-400">Incoming dispatch alerts & SLA monitoring</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sound & Voice Settings Bar */}
          <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={toggleSound}
                className={`px-2 py-1 rounded-lg border flex items-center space-x-1 font-bold text-[10px] transition cursor-pointer ${
                  muted
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
                title={muted ? 'Unmute Audio Chime' : 'Mute Audio Chime'}
              >
                {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                <span>{muted ? 'Muted' : 'Sound On'}</span>
              </button>

              <button
                type="button"
                onClick={toggleVoice}
                className={`px-2 py-1 rounded-lg border flex items-center space-x-1 font-bold text-[10px] transition cursor-pointer ${
                  !voiceEnabled
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}
                title={voiceEnabled ? 'Disable Voice Alerts' : 'Enable Voice Alerts'}
              >
                {voiceEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                <span>{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
              </button>

              {browserPermission === 'default' && (
                <button
                  type="button"
                  onClick={requestBrowserPermission}
                  className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center space-x-1 font-bold text-[10px] transition cursor-pointer"
                  title="Enable Browser Desktop Push Alerts"
                >
                  <Bell className="w-3 h-3 text-amber-600" />
                  <span>Push</span>
                </button>
              )}

              {browserPermission === 'granted' && (
                <span
                  className="px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center space-x-1 font-bold text-[10px]"
                  title="Browser Desktop Push Active"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Push Active</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={testAlert}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-0.5 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Test Alert</span>
            </button>
          </div>

          {/* Operational Action Bar: Filter Tabs + Bulk Actions */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            {/* Filter Pills */}
            <div className="flex items-center space-x-1 p-0.5 bg-slate-200/80 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] transition cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('pending')}
                className={`px-2.5 py-1 rounded-md text-[11px] transition flex items-center space-x-1 cursor-pointer ${
                  filterTab === 'pending'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Unread ({pendingCount})</span>
                {pendingCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('viewed')}
                className={`px-2.5 py-1 rounded-md text-[11px] transition cursor-pointer ${
                  filterTab === 'viewed'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Seen ({viewedCount})
              </button>
            </div>

            {/* Quick Actions: Mark All Seen & Clear All */}
            <div className="flex items-center space-x-1.5 text-xs">
              {onMarkAllSeen && (
                <button
                  type="button"
                  onClick={onMarkAllSeen}
                  disabled={pendingCount === 0}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-bold text-[11px] shadow-2xs flex items-center space-x-1 transition disabled:opacity-40 cursor-pointer"
                  title="Mark all pending notifications as attended/seen"
                >
                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                  <span>Mark Seen</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClearAll}
                disabled={notifications.length === 0}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 font-bold text-[11px] shadow-2xs flex items-center space-x-1 transition disabled:opacity-40 cursor-pointer"
                title="Clear all notifications permanently (will not reappear on refresh)"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Notifications List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {displayedList.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  {filterTab === 'pending'
                    ? 'All leads attended!'
                    : filterTab === 'viewed'
                    ? 'No seen notifications yet'
                    : 'Notification tray is empty'}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                  {filterTab === 'pending'
                    ? 'You have responded to all assigned dispatch leads. Fresh leads will pop up with live voice and sound.'
                    : 'Newly assigned freight inquiries will appear here automatically.'}
                </p>
                {filterTab !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View All Notifications
                  </button>
                )}
              </div>
            ) : (
              displayedList.map((notif) => {
                const isPending = notif.status === 'pending';
                const cleanPhone = notif.phone ? notif.phone.replace(/[^0-9]/g, '') : '';

                return (
                  <div
                    key={notif.id}
                    className={`group relative rounded-2xl p-4 shadow-xs transition-all duration-150 ${
                      isPending
                        ? 'bg-white border-2 border-slate-200 hover:border-blue-500 shadow-sm'
                        : 'bg-slate-50/70 border border-slate-200 opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Card Top Row: Badge, Timestamp, Mark Seen, Dismiss Button */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-1.5">
                        {isPending ? (
                          <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            <Flame className="w-3 h-3 mr-1 text-amber-600" />
                            {notif.type === 'sla_reminder' ? 'SLA Alert' : 'New Lead'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            Seen
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{getTimeAgo(notif.createdAt)}</span>
                        </span>

                        {/* Individual Mark as Seen Button (if pending) */}
                        {isPending && onMarkSeen && (
                          <button
                            type="button"
                            onClick={() => onMarkSeen(notif.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            title="Mark as Seen / Attended"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Dismiss Cut Button (Permanently prevents reappearing) */}
                        <button
                          type="button"
                          onClick={() => onDismiss(notif.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Dismiss notification (will not reappear on refresh)"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-2">
                      <div className="text-xs font-black text-slate-900 flex items-center justify-between">
                        <span>{notif.customerName}</span>
                        {isPending && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                        )}
                      </div>
                      {notif.companyName && (
                        <div className="text-[11px] text-slate-500 font-medium">{notif.companyName}</div>
                      )}
                    </div>

                    {/* Commercial Approver Badge (if decision-maker differs) */}
                    {notif.approverPhone && notif.approverPhone !== notif.phone && (
                      <div className="mb-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200/90 text-[11px] text-amber-950 flex items-center justify-between">
                        <div className="min-w-0 pr-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 block">👑 Commercial Approver</span>
                          <span className="font-extrabold truncate block">{notif.approverName || notif.approverPhone}</span>
                          {notif.approverRole && (
                            <span className="text-[10px] text-amber-700 block truncate">{notif.approverRole}</span>
                          )}
                        </div>
                        <a
                          href={`tel:${notif.approverPhone.replace(/\D/g, '')}`}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 shadow-2xs"
                        >
                          Call Approver
                        </a>
                      </div>
                    )}

                    {/* Route Details */}
                    <div className="bg-slate-50 rounded-xl p-2.5 text-xs font-bold text-slate-800 mb-2 flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{notif.origin}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="truncate text-blue-900">{notif.destination}</span>
                    </div>

                    {/* Vehicle Specifications */}
                    <div className="flex items-center space-x-3 text-[11px] font-semibold text-slate-600 mb-3">
                      <span className="flex items-center">
                        <Truck className="w-3 h-3 mr-1 text-indigo-500" />
                        {notif.vehicleType || 'Any Truck'}
                      </span>
                      {notif.weight && <span className="text-slate-400">· {notif.weight}</span>}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenLead(notif.bookingId);
                          onClose();
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-xs cursor-pointer"
                      >
                        <span>Open Lead</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Drawer Footer */}
          {notifications.length > 0 && (
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs font-bold text-slate-600 hover:text-rose-600 flex items-center space-x-1.5 transition cursor-pointer"
                title="Clear all notifications from drawer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Clear All Notifications</span>
              </button>

              {pendingCount > 0 && onMarkAllSeen && (
                <button
                  type="button"
                  onClick={onMarkAllSeen}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs flex items-center space-x-1 transition cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark All Seen</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
