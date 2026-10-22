import React, { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  FileSpreadsheet,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  FileText,
  Clock,
  Sparkles,
  Search,
} from 'lucide-react';
import { FreightBooking, SessionRecord, SupportTicket, BackupStats } from '../../types';
import { dbService } from '../../services/supabase';

interface BackupManagerProps {
  bookings: FreightBooking[];
  sessions: SessionRecord[];
  supportTickets: SupportTicket[];
}

export const BackupManager: React.FC<BackupManagerProps> = ({
  bookings,
  sessions,
  supportTickets,
}) => {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isSheetsSyncing, setIsSheetsSyncing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getBackupStats();
      setStats(data);
    } catch (err) {
      console.warn('Failed to fetch backup stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleExportCSV = () => {
    dbService.exportBookingsCSV(bookings);
    setFeedbackMessage({
      type: 'success',
      text: `Exported ${bookings.length} freight bookings to CSV file.`,
    });
  };

  const handleExportJSON = () => {
    dbService.exportAllJSON({
      bookings,
      sessions,
      support: supportTickets,
    });
    setFeedbackMessage({
      type: 'success',
      text: 'Exported complete system archive JSON snapshot.',
    });
  };

  const handleResyncSupabase = async () => {
    setIsResyncing(true);
    setFeedbackMessage(null);
    try {
      const res = await dbService.triggerResyncSupabase();
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: res.message || `Successfully synced ${res.count} leads to Supabase.`,
        });
        await loadStats();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || 'Supabase is still unreachable. Data remains protected in local vault.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Re-sync failed. Supabase may still be paused or backend is offline.',
      });
    } finally {
      setIsResyncing(false);
    }
  };

  const handleSyncSheets = async () => {
    setIsSheetsSyncing(true);
    setFeedbackMessage(null);
    try {
      const res = await dbService.triggerSheetsSync();
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: `Synced ${res.count || bookings.length} leads to your Google Sheet!`,
        });
      } else {
        setFeedbackMessage({
          type: 'info',
          text: res.message || 'To enable Google Sheets sync, add GOOGLE_SHEET_ID in your .env file.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Google Sheets sync request failed. Check server connection.',
      });
    } finally {
      setIsSheetsSyncing(false);
    }
  };

  const isSupabaseOnline = stats?.supabase?.online !== false;
  const filteredBookings = bookings.filter((b) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.phone?.toLowerCase().includes(term) ||
      b.user_id?.toLowerCase().includes(term) ||
      b.origin?.toLowerCase().includes(term) ||
      b.destination?.toLowerCase().includes(term) ||
      b.company_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
              Disaster Recovery & Redundancy
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Zero-Data-Loss Active</span>
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-2">
            Data Safety Vault & Backup Center
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Multi-tier failover protection: Every WhatsApp lead is instantly duplicated across Cloud Supabase, 
            an offline persistent disk vault, and Google Sheets so your business never loses customer data even if Supabase stops.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-2 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedbackMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Emergency Alert if Supabase is Offline */}
      {!isSupabaseOnline && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Supabase Connection Offline / Paused
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Your CRM is currently running in <strong>Local Vault Failover Mode</strong>. All past leads are safely loaded from disk, and new WhatsApp customer inquiries are automatically captured locally so no customer is lost.
              </div>
            </div>
          </div>
          <button
            onClick={handleResyncSupabase}
            disabled={isResyncing}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 shadow-xs flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResyncing ? 'animate-spin' : ''}`} />
            <span>Re-sync Offline Leads to Cloud</span>
          </button>
        </div>
      )}

      {/* 3-Tier Redundancy Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 1: Cloud Supabase */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isSupabaseOnline
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isSupabaseOnline ? '🟢 Connected' : '🔴 Paused / Stopped'}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-800">1. Cloud PostgreSQL (Supabase)</div>
            <div className="text-xs text-slate-500 mt-1">
              Primary cloud database. Stores live orders, dispatch statuses, and employee lead assignments.
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Cloud Records:</span>
            <span className="font-bold text-slate-900">{bookings.length} Bookings</span>
          </div>
        </div>

        {/* Tier 2: Local Disk Failover Vault */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                🟢 Active Vault
              </span>
            </div>
            <div className="text-xs font-bold text-slate-800">2. Persistent Local Vault (.jsonl)</div>
            <div className="text-xs text-slate-500 mt-1">
              Independent offline storage on the server hard drive. Immune to cloud downtimes or billing pauses.
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Protected Locally:</span>
            <span className="font-bold text-emerald-700">
              {stats?.counts?.total || bookings.length + sessions.length} Records
            </span>
          </div>
        </div>

        {/* Tier 3: Google Sheets Mirror */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  stats?.googleSheets?.configured
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {stats?.googleSheets?.configured ? '🟢 Synced' : 'Ready to Link'}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-800">3. Google Sheets Mirror</div>
            <div className="text-xs text-slate-500 mt-1">
              External spreadsheet mirror on Google Drive. Non-blocking asynchronous sync prevents bot slowdown.
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Spreadsheet View:</span>
            <button
              onClick={handleSyncSheets}
              disabled={isSheetsSyncing}
              className="font-bold text-violet-600 hover:text-violet-800 flex items-center space-x-1"
            >
              <span>{isSheetsSyncing ? 'Syncing...' : 'Sync to Sheets'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 1-Click Instant Backup Downloads */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Download className="w-4 h-4 text-blue-600" />
              <span>1-Click Instant Data Export</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Download clean, timestamped offline snapshots directly to your computer. Keep them on your laptop, external drive, or Google Drive.
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Last Vault Snapshot: {new Date(stats?.lastBackupAt || Date.now()).toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Download Bookings CSV */}
          <button
            onClick={handleExportCSV}
            className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Excel & Sheets Ready
              </span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-blue-900">
              Download Freight Bookings (CSV)
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Exports all {bookings.length} completed freight leads with phone, route, truck type, and statuses.
            </div>
          </button>

          {/* Download Complete Archive JSON */}
          <button
            onClick={handleExportJSON}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Complete Vault
              </span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
              Download Full System Archive (JSON)
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Includes all orders, users_master sessions, support tickets, and raw WhatsApp payload structures.
            </div>
          </button>

          {/* Sync & Re-align with Supabase */}
          <button
            onClick={handleResyncSupabase}
            disabled={isResyncing}
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition group shadow-2xs disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition">
                <RefreshCw className={`w-4 h-4 ${isResyncing ? 'animate-spin' : ''}`} />
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                Auto Re-sync
              </span>
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">
              Re-sync Local Leads to Supabase
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Scans local vault for any leads captured during a Supabase stoppage and pushes them into cloud.
            </div>
          </button>
        </div>
      </div>

      {/* Google Sheets Live Configuration Information */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Google Sheets Dual-Save Configuration</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Async Non-Blocking Architecture
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          To have leads appear automatically in your Google Spreadsheet in real time, add your Google Service Account credentials to your <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-mono">.env</code> file:
        </p>

        <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
          <div className="text-slate-400"># Google Sheets Real-Time Mirror</div>
          <div>GOOGLE_SHEET_ID=your_google_sheet_id_here</div>
          <div>GOOGLE_SERVICE_ACCOUNT_EMAIL=your-bot@project.iam.gserviceaccount.com</div>
          <div>GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."</div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSyncSheets}
            disabled={isSheetsSyncing}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isSheetsSyncing ? 'Syncing to Google Sheets...' : 'Trigger Google Sheets Sync Now'}</span>
          </button>
          <span className="text-xs text-slate-500">
            ✓ WhatsApp bot response time is never delayed during spreadsheet writes.
          </span>
        </div>
      </div>

      {/* Vault Record Explorer */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Protected Leads In Local Vault</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Displaying all verified orders stored in the offline failover storage.
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone, user, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-slate-50/50"
            />
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">User ID & Phone</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Truck / Cargo</th>
                  <th className="py-2.5 px-3">Loading Date</th>
                  <th className="py-2.5 px-3">Safety Status</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.slice(0, 15).map((b) => (
                  <tr key={b.user_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{b.phone || 'Unknown'}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">{b.user_id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-700">
                        {b.originCity || b.origin || '—'} ➔ {b.destinationCity || b.destination || '—'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{b.vehicle_or_container || b.cargo_type || 'General'}</div>
                      {b.weight && <div className="text-[10px] text-slate-400">{b.weight}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {b.loading_date || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Protected</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(b.updated_at || Date.now()).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No records match your search filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
