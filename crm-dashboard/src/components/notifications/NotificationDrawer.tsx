import React from 'react';
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
  onTriggerTestAlert?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onOpenLead,
  onDismiss,
  onClearAll,
  onTriggerTestAlert,
}) => {
  const [muted, setMuted] = React.useState<boolean>(() => isAudioMuted());
  const [voiceEnabled, setVoiceState] = React.useState<boolean>(() => isVoiceNotificationEnabled());
  const [browserPermission, setBrowserPermission] = React.useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });

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

  const pendingList = notifications.filter((n) => n.status === 'pending');

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

  return (
    <div className="fixed inset-0 z-40 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-black tracking-tight text-white">Lead Notifications</h3>
                  {pendingList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                      {pendingList.length} Pending
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Incoming dispatch alerts & reminders</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sound & Voice Settings Bar */}
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleSound}
                className={`p-1.5 rounded-md border flex items-center space-x-1 font-semibold text-[11px] transition ${
                  muted
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
                title={muted ? 'Unmute Audio Chime' : 'Mute Audio Chime'}
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{muted ? 'Muted' : 'Sound On'}</span>
              </button>

              <button
                onClick={toggleVoice}
                className={`p-1.5 rounded-md border flex items-center space-x-1 font-semibold text-[11px] transition ${
                  !voiceEnabled
                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                }`}
                title={voiceEnabled ? 'Disable Voice Alerts' : 'Enable Voice Alerts'}
              >
                {voiceEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
              </button>

              {browserPermission === 'default' && (
                <button
                  onClick={requestBrowserPermission}
                  className="p-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center space-x-1 font-semibold text-[11px] transition"
                  title="Enable Browser Desktop Push Alerts"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span>Push</span>
                </button>
              )}

              {browserPermission === 'granted' && (
                <span
                  className="p-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center space-x-1 font-semibold text-[11px]"
                  title="Browser Desktop Notifications Active"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Push On</span>
                </span>
              )}
            </div>

            <button
              onClick={testAlert}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline decoration-dotted"
            >
              Test Alert
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {pendingList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">All caught up!</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  You have no pending lead reminders. Any newly assigned leads will pop up with full focus and sound.
                </p>
              </div>
            ) : (
              pendingList.map((notif) => {
                const cleanPhone = notif.phone ? notif.phone.replace(/[^0-9]/g, '') : '';
                return (
                  <div
                    key={notif.id}
                    className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-400 p-4 shadow-xs transition-all hover:shadow-md"
                  >
                    {/* Top status indicator */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                        <Flame className="w-3 h-3 mr-1 text-amber-600" />
                        {notif.type === 'sla_reminder' ? 'SLA Alert' : 'Pending Lead'}
                      </span>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>{getTimeAgo(notif.createdAt)}</span>
                        <button
                          onClick={() => onDismiss(notif.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Dismiss notification"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Customer info */}
                    <div className="mb-2.5">
                      <div className="text-xs font-black text-slate-900">{notif.customerName}</div>
                      {notif.companyName && (
                        <div className="text-[11px] text-slate-500 font-medium">{notif.companyName}</div>
                      )}
                    </div>

                    {/* Decision Maker badge if on behalf */}
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

                    {/* Route */}
                    <div className="bg-slate-50 rounded-xl p-2.5 text-xs font-bold text-slate-800 mb-2 flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{notif.origin}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="truncate text-blue-900">{notif.destination}</span>
                    </div>

                    {/* Specs */}
                    <div className="flex items-center space-x-3 text-[11px] font-semibold text-slate-600 mb-3">
                      <span className="flex items-center">
                        <Truck className="w-3 h-3 mr-1 text-indigo-500" />
                        {notif.vehicleType || 'Any Truck'}
                      </span>
                      {notif.weight && <span className="text-slate-400">· {notif.weight}</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center space-x-1.5 transition"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>

                      <button
                        onClick={() => {
                          onOpenLead(notif.bookingId);
                          onClose();
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-xs"
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

          {/* Footer */}
          {pendingList.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={onClearAll}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 flex items-center space-x-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dismiss All</span>
              </button>
              <div className="text-[11px] text-slate-400">
                Updating lead status marks it attended
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
