import React, { useState } from 'react';
import {
  Package,
  Calendar,
  Phone,
  PhoneCall,
  MapPin,
  Clock,
  ExternalLink,
  Info,
  X,
  FileText,
  Weight,
  Truck,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { FreightBooking } from '../../types';

interface BookingsTableProps {
  bookings: FreightBooking[];
  searchQuery: string;
  onUpdateStatus: (userId: string, status: FreightBooking['status'], remarks?: string) => void;
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  bookings,
  searchQuery,
  onUpdateStatus,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cargoFilter, setCargoFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<FreightBooking | null>(null);
  const [remarksInput, setRemarksInput] = useState<string>('');
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);

  // Filter logic
  const filtered = bookings.filter((b) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (b.contact_name || '').toLowerCase().includes(query) ||
      (b.company_name || '').toLowerCase().includes(query) ||
      (b.phone || '').includes(query) ||
      (b.alternate_phone || '').includes(query) ||
      (b.origin || '').toLowerCase().includes(query) ||
      (b.destination || '').toLowerCase().includes(query) ||
      (b.originCity || '').toLowerCase().includes(query) ||
      (b.destinationCity || '').toLowerCase().includes(query) ||
      (b.material_or_line || '').toLowerCase().includes(query) ||
      (b.vehicle_or_container || '').toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesCargo = cargoFilter === 'all' || b.cargo_type.toLowerCase() === cargoFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesCargo;
  });

  const getStatusBadge = (status: FreightBooking['status']) => {
    switch (status) {
      case 'new':
        return {
          label: 'New Lead',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
        };
      case 'quoted':
        return {
          label: 'Quoted',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'confirmed':
        return {
          label: 'Confirmed',
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          dot: 'bg-blue-400',
        };
      case 'in_transit':
        return {
          label: 'In Transit',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          dot: 'bg-purple-400',
        };
      case 'completed':
        return {
          label: 'Completed',
          color: 'bg-slate-700/60 text-slate-300 border-slate-600/40',
          dot: 'bg-slate-400',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
        };
      default:
        return {
          label: status,
          color: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const getWhatsAppQuoteUrl = (b: FreightBooking, isAlternate = false) => {
    const rawPhone = isAlternate ? b.alternate_phone : b.phone;
    const phone = cleanPhone(rawPhone);
    if (!phone) return '#';

    const origin = b.originCity ? `${b.originCity} (${b.origin})` : b.origin;
    const dest = b.destinationCity ? `${b.destinationCity} (${b.destination})` : b.destination;
    const vehicle = b.vehicle_or_container || 'Vehicle';
    const weight = b.weight ? ` | ${b.weight}` : '';
    const name = b.contact_name ? ` ${b.contact_name}` : '';

    const text = `Hello${name}! Regarding your freight booking with Traket Logistics:\n\n📍 Route: ${origin} ➔ ${dest}\n🚛 Vehicle: ${vehicle}${weight}\n📅 Date: ${b.loading_date} (${b.time_slot || 'Anytime'})\n\nOur team has reviewed your load requirement. May we provide you with our competitive quote?`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const openDetailsModal = (b: FreightBooking) => {
    setSelectedBooking(b);
    setRemarksInput(b.remarks || '');
  };

  const handleSaveRemarks = async () => {
    if (!selectedBooking) return;
    setIsSavingRemarks(true);
    await onUpdateStatus(selectedBooking.user_id, selectedBooking.status, remarksInput);
    setSelectedBooking({ ...selectedBooking, remarks: remarksInput });
    setIsSavingRemarks(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters & Control Bar */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All Orders', count: bookings.length },
            { id: 'new', label: 'New Leads', count: bookings.filter((b) => b.status === 'new').length },
            { id: 'quoted', label: 'Quoted', count: bookings.filter((b) => b.status === 'quoted').length },
            { id: 'confirmed', label: 'Confirmed', count: bookings.filter((b) => b.status === 'confirmed').length },
            { id: 'completed', label: 'Completed', count: bookings.filter((b) => b.status === 'completed').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center space-x-1.5 ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-semibold'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Cargo Type Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 font-medium">Cargo:</span>
          <select
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Cargo Types</option>
            <option value="domestic">Domestic</option>
            <option value="exim fcl">EXIM FCL</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Route & PINs</th>
                <th className="py-3 px-4">Cargo & Vehicle Specs</th>
                <th className="py-3 px-4">Loading Schedule</th>
                <th className="py-3 px-4">Shipper / Contact</th>
                <th className="py-3 px-4">1-Click WhatsApp / Call</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Package className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-slate-400">No freight orders found</p>
                      <p className="text-[11px] text-slate-400">
                        Orders captured by your WhatsApp bot will automatically appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const badge = getStatusBadge(b.status);
                  return (
                    <tr
                      key={b.user_id}
                      className="hover:bg-slate-800/40 transition duration-150 group"
                    >
                      {/* Route */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5 text-white font-bold">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-[140px]" title={b.origin}>
                              {b.originCity || b.origin || 'Origin'}
                            </span>
                            <span className="text-slate-400 font-normal">➔</span>
                            <span className="truncate max-w-[140px]" title={b.destination}>
                              {b.destinationCity || b.destination || 'Destination'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1.5">
                            <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {b.origin || '—'}
                            </span>
                            <span>to</span>
                            <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {b.destination || '—'}
                            </span>
                            {b.estimatedDistanceKm ? (
                              <span className="text-slate-400 font-mono">
                                (~{b.estimatedDistanceKm} km)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Cargo & Vehicle Specs */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-white truncate max-w-[160px]">
                              {b.vehicle_or_container || 'Standard Vehicle'}
                            </span>
                            {b.cargo_type && (
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                                {b.cargo_type}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                            {b.weight && (
                              <span className="flex items-center space-x-0.5 text-amber-300 font-semibold font-mono">
                                <Weight className="w-3 h-3 text-amber-400" />
                                <span>{b.weight}</span>
                              </span>
                            )}
                            {b.material_or_line && (
                              <span className="truncate max-w-[120px] text-slate-400" title={b.material_or_line}>
                                • {b.material_or_line}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Loading Schedule */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-slate-200 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{b.loading_date || 'Immediate'}</span>
                          </div>
                          {b.time_slot && (
                            <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">
                                {b.time_slot}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Shipper Contact */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white truncate max-w-[140px]">
                            {b.contact_name || 'Inquiry Contact'}
                          </div>
                          {b.company_name && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                              {b.company_name}
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-emerald-400/90">
                            {b.phone}
                          </div>
                        </div>
                      </td>

                      {/* 1-Click WhatsApp / Call */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          {/* Primary WhatsApp */}
                          <a
                            href={getWhatsAppQuoteUrl(b, false)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Send Quote to Primary WhatsApp (${b.phone})`}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm shadow-emerald-700/40 transition"
                          >
                            <span>WhatsApp</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>

                          {/* Alternate WhatsApp if present */}
                          {b.alternate_phone ? (
                            <a
                              href={getWhatsAppQuoteUrl(b, true)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Send Quote to Alternate WhatsApp (${b.alternate_phone})`}
                              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-teal-700/70 hover:bg-teal-600 text-teal-100 font-semibold text-[10px] border border-teal-500/30 transition"
                            >
                              <span>Alt WA</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : null}

                          {/* Direct Phone Call */}
                          {b.phone && (
                            <a
                              href={`tel:${b.phone}`}
                              title={`Call Primary Phone (${b.phone})`}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                            >
                              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={b.status}
                          onChange={(e) =>
                            onUpdateStatus(b.user_id, e.target.value as FreightBooking['status'])
                          }
                          className={`text-[11px] font-semibold rounded-lg px-2 py-1 border focus:outline-none cursor-pointer transition ${badge.color}`}
                        >
                          <option value="new" className="bg-slate-900 text-emerald-300">🟢 New Lead</option>
                          <option value="quoted" className="bg-slate-900 text-amber-300">🟡 Quoted</option>
                          <option value="confirmed" className="bg-slate-900 text-blue-300">🔵 Confirmed</option>
                          <option value="in_transit" className="bg-slate-900 text-purple-300">🟣 In Transit</option>
                          <option value="completed" className="bg-slate-900 text-slate-300">⚪ Completed</option>
                          <option value="cancelled" className="bg-slate-900 text-rose-300">🔴 Cancelled</option>
                        </select>
                      </td>

                      {/* View Details */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openDetailsModal(b)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-[11px] font-medium transition inline-flex items-center space-x-1"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over / Modal for Order Details */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Freight Order Details</h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Route & Cargo Header */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {selectedBooking.cargo_type} Flow
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(selectedBooking.updated_at).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-white font-extrabold text-sm">
                <span>{selectedBooking.originCity || selectedBooking.origin}</span>
                <span className="text-emerald-400">➔</span>
                <span>{selectedBooking.destinationCity || selectedBooking.destination}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Vehicle / Container</span>
                  <span className="font-semibold text-white">{selectedBooking.vehicle_or_container || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Weight / Capacity</span>
                  <span className="font-semibold text-amber-300 font-mono">{selectedBooking.weight || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Loading Date & Slot</span>
                  <span className="text-slate-200">
                    {selectedBooking.loading_date} ({selectedBooking.time_slot || 'Anytime'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Material / Line</span>
                  <span className="text-slate-200">{selectedBooking.material_or_line || '—'}</span>
                </div>
              </div>
            </div>

            {/* Shipper & Contacts */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Shipper Information
              </h4>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Contact Person:</span>
                  <span className="font-semibold text-white">{selectedBooking.contact_name || '—'}</span>
                </div>
                {selectedBooking.company_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Company Name:</span>
                    <span className="font-semibold text-white">{selectedBooking.company_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Primary Phone:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{selectedBooking.phone}</span>
                </div>
                {selectedBooking.alternate_phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Alternate Phone:</span>
                    <span className="font-mono text-teal-400 font-semibold">{selectedBooking.alternate_phone}</span>
                  </div>
                )}
                {selectedBooking.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-slate-300">{selectedBooking.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks / Dispatcher Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rate Quote & Internal Notes
                </h4>
                <button
                  onClick={handleSaveRemarks}
                  disabled={isSavingRemarks}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-60"
                >
                  {isSavingRemarks ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
              <textarea
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
                placeholder="Add quotation price (e.g. Quoted ₹42,000 for 21T Taurus), driver contact, or notes..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Fast Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800">
              <a
                href={getWhatsAppQuoteUrl(selectedBooking, false)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition"
              >
                <span>WhatsApp Quote</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
