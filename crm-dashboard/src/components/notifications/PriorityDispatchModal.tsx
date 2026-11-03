import React, { useEffect, useState } from 'react';
import {
  Phone,
  MapPin,
  Truck,
  ArrowRight,
  Clock,
  BellRing,
  ExternalLink,
  ChevronDown,
  Volume2,
  VolumeX,
  X,
  Sparkles,
} from 'lucide-react';
import { LeadNotification } from '../../types';
import { isAudioMuted, setAudioMuted, isVoiceNotificationEnabled, setVoiceEnabled } from '../../utils/sound';

interface PriorityDispatchModalProps {
  notification: LeadNotification | null;
  onOpenLead: (bookingId: string) => void;
  onDockToTray: (notificationId: string) => void;
}

export const PriorityDispatchModal: React.FC<PriorityDispatchModalProps> = ({
  notification,
  onOpenLead,
  onDockToTray,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);
  const [muted, setMuted] = useState<boolean>(() => isAudioMuted());
  const [voiceOn, setVoiceOn] = useState<boolean>(() => isVoiceNotificationEnabled());
  const dockRef = React.useRef(onDockToTray);

  useEffect(() => {
    dockRef.current = onDockToTray;
  }, [onDockToTray]);

  useEffect(() => {
    if (!notification) return;

    setSecondsRemaining(10);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          dockRef.current(notification.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [notification?.id]);

  if (!notification) return null;

  const progressPercent = (secondsRemaining / 10) * 100;

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  const cleanPhone = notification.phone ? notification.phone.replace(/[^0-9]/g, '') : '';
  const displayPhone = cleanPhone.length === 10
    ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`
    : cleanPhone.startsWith('91') && cleanPhone.length === 12
    ? `+91 ${cleanPhone.slice(2, 7)} ${cleanPhone.slice(7)}`
    : notification.phone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
      {/* Background radial gradient glow for dramatic focus */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent pointer-events-none" />

      {/* Main Alert Card */}
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border-2 border-blue-500/30 overflow-hidden transform animate-in zoom-in-95 duration-200">
        
        {/* 10-Second Auto-Dock Progress Bar at Top */}
        <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Header Alert Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center animate-bounce shrink-0 shadow-inner">
              <BellRing className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black tracking-wider uppercase bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full shadow-xs">
                  {notification.type === 'sla_reminder' ? '⚠️ Overdue Follow-up' : '🚨 New Lead Assigned'}
                </span>
                <span className="text-[11px] font-semibold text-blue-100 flex items-center">
                  <Clock className="w-3 h-3 mr-1" /> Auto-dock in {secondsRemaining}s
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                Immediate Action Required
              </h2>
            </div>
          </div>

          {/* Sound Mute & Dismiss Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleSound}
              title={muted ? 'Unmute Audio Alerts' : 'Mute Audio Alerts'}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-xs flex items-center"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
            </button>
            <button
              onClick={() => onDockToTray(notification.id)}
              title="Dock to Notification Tray"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Customer & Contact Row */}
          <div className="flex items-start justify-between bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Customer Details
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {notification.customerName || 'Direct Freight Shipper'}
              </h3>
              {notification.companyName && (
                <p className="text-xs font-medium text-slate-500">{notification.companyName}</p>
              )}
            </div>

            <a
              href={`tel:${cleanPhone}`}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
            >
              <Phone className="w-3.5 h-3.5 fill-current" />
              <span>{displayPhone}</span>
            </a>
          </div>

          {/* Route Section */}
          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-2 flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1" /> Route Requirement
            </div>
            <div className="flex items-center space-x-3 text-slate-900 font-extrabold text-sm sm:text-base">
              <span className="truncate max-w-[42%] text-slate-900">
                {notification.origin || 'Source'}
              </span>
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <span className="truncate max-w-[42%] text-blue-900">
                {notification.destination || 'Destination'}
              </span>
            </div>
          </div>

          {/* Fleet & Cargo Spec Badges */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-400">Vehicle Type</div>
                <div className="font-bold text-slate-800 truncate">
                  {notification.vehicleType || 'Any Truck'}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-400">Material / Weight</div>
                <div className="font-bold text-slate-800 truncate">
                  {notification.material || 'Standard Goods'} {notification.weight ? `(${notification.weight})` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between space-x-3">
          <button
            onClick={() => onDockToTray(notification.id)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs"
          >
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Dock to Notification Tray</span>
          </button>

          <button
            onClick={() => onOpenLead(notification.bookingId)}
            className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold transition shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 active:scale-95"
          >
            <span>Open & Attend Lead</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
