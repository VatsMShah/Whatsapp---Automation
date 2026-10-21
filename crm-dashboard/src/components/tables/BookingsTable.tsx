import React, { useState } from 'react';
import {
  Package,
  Calendar,
  Phone,
  MapPin,
  Clock,
  X,
  FileText,
  Weight,
  Truck,
  ChevronRight,
  Hash,
  ArrowRight,
  Box,
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

  // Helper to extract the new ID from `phone_newId` format
  const extractShortId = (userId: string) => {
    if (!userId) return '—';
    if (userId.includes('_')) {
      const parts = userId.split('_');
      return parts.slice(1).join('_');
    }
    return userId;
  };

  // Helper to format phone cleanly
  const formatPhone = (phone?: string) => {
    if (!phone) return '—';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
    if (clean.length === 12 && clean.startsWith('91')) {
      return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
    }
    return phone;
  };

  // Filter logic
  const filtered = bookings.filter((b) => {
    const query = searchQuery.toLowerCase().trim();
    const shortId = extractShortId(b.user_id).toLowerCase();
    const matchesSearch =
      !query ||
      shortId.includes(query) ||
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
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-600',
        };
      case 'quoted':
        return {
          label: 'Quoted',
          color: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'confirmed':
        return {
          label: 'Confirmed',
          color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-600',
        };
      case 'in_transit':
        return {
          label: 'In Transit',
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-500',
        };
      case 'completed':
        return {
          label: 'Completed',
          color: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
        };
      default:
        return {
          label: status,
          color: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
    }
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
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
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
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Cargo Type Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-medium">Cargo:</span>
          <select
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All Cargo Types</option>
            <option value="domestic">Domestic</option>
            <option value="exim fcl">EXIM FCL</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3.5 whitespace-nowrap">User ID</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Customer Name</th>
                <th className="py-3 px-3.5 whitespace-nowrap">WhatsApp Number</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Alternate Number</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Route (Locations)</th>
                <th className="py-3 px-3.5 whitespace-nowrap">PIN to PIN</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Cargo & Vehicle Specs</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Material / Goods</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Loading Schedule</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Company Name</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Package className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-slate-700">No freight orders found</p>
                      <p className="text-[11px] text-slate-500">
                        Orders captured by your WhatsApp bot will automatically appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const badge = getStatusBadge(b.status);
                  const shortId = extractShortId(b.user_id);

                  return (
                    <tr
                      key={b.user_id}
                      className="hover:bg-slate-50/80 transition duration-150 group"
                    >
                      {/* 1. User ID (Clean without hashtag) */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/80 inline-block">
                          {shortId}
                        </span>
                      </td>

                      {/* 2. Customer Name */}
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold text-slate-900 truncate max-w-[130px]">
                          {b.contact_name || 'Inquiry Contact'}
                        </div>
                      </td>

                      {/* 3. WhatsApp Number */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-slate-900 font-mono font-medium text-[11px]">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{formatPhone(b.phone)}</span>
                        </div>
                      </td>

                      {/* 4. Alternate Number */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {b.alternate_phone ? (
                          <div className="flex items-center space-x-1 text-slate-700 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{formatPhone(b.alternate_phone)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* 5. Route (Locations from where to where) */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center space-x-1.5 text-slate-900 font-bold text-xs">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate max-w-[130px]" title={b.originCity || b.origin}>
                            {b.originCity || b.origin || 'Origin'}
                          </span>
                          <span className="text-slate-400 font-normal">➔</span>
                          <span className="truncate max-w-[130px]" title={b.destinationCity || b.destination}>
                            {b.destinationCity || b.destination || 'Destination'}
                          </span>
                        </div>
                      </td>

                      {/* 6. PIN to PIN (421201 --> 700001) */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-mono text-slate-800 font-medium flex items-center space-x-1">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {b.origin || '—'}
                            </span>
                            <span className="text-slate-400">➔</span>
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {b.destination || '—'}
                            </span>
                          </div>
                          {b.estimatedDistanceKm ? (
                            <div className="text-[10px] text-slate-500 font-mono">
                              ~{b.estimatedDistanceKm} km
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* 7. Cargo & Vehicle Specs (Material removed from here) */}
                      <td className="py-3.5 px-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                              {b.vehicle_or_container || 'Standard Vehicle'}
                            </span>
                            {b.cargo_type && (
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {b.cargo_type}
                              </span>
                            )}
                          </div>
                          {b.weight && (
                            <div className="flex items-center space-x-0.5 text-amber-700 font-semibold font-mono text-[10px]">
                              <Weight className="w-3 h-3 text-amber-600" />
                              <span>{b.weight}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 8. Material / Goods Description (Dedicated Column) */}
                      <td className="py-3.5 px-3.5">
                        {b.material_or_line ? (
                          <div className="flex items-center space-x-1 text-slate-800 font-medium text-xs">
                            <Box className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]" title={b.material_or_line}>
                              {b.material_or_line}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* 9. Loading Schedule */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1 text-slate-800 font-medium text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>{b.loading_date || 'Immediate'}</span>
                          </div>
                          {b.time_slot && (
                            <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200 text-slate-600">
                                {b.time_slot}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 10. Company Name (Dedicated Column before Status) */}
                      <td className="py-3.5 px-3.5">
                        {b.company_name ? (
                          <div className="font-semibold text-slate-900 truncate max-w-[130px]" title={b.company_name}>
                            {b.company_name}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* 11. Status Selector */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <select
                          value={b.status}
                          onChange={(e) =>
                            onUpdateStatus(b.user_id, e.target.value as FreightBooking['status'])
                          }
                          className={`text-[11px] font-semibold rounded-lg px-2 py-1 border focus:outline-none cursor-pointer transition ${badge.color}`}
                        >
                          <option value="new" className="bg-white text-blue-700">🟢 New Lead</option>
                          <option value="quoted" className="bg-white text-amber-700">🟡 Quoted</option>
                          <option value="confirmed" className="bg-white text-indigo-700">🔵 Confirmed</option>
                          <option value="in_transit" className="bg-white text-purple-700">🟣 In Transit</option>
                          <option value="completed" className="bg-white text-slate-700">⚪ Completed</option>
                          <option value="cancelled" className="bg-white text-rose-700">🔴 Cancelled</option>
                        </select>
                      </td>

                      {/* 12. Details Modal Trigger */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => openDetailsModal(b)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-[11px] font-medium transition inline-flex items-center space-x-1"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3 h-3 text-slate-500" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl relative text-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Freight Order {extractShortId(selectedBooking.user_id)}</h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Route & Cargo Header */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded border border-blue-200">
                  {selectedBooking.cargo_type} Flow
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {new Date(selectedBooking.updated_at).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm">
                <span>{selectedBooking.originCity || selectedBooking.origin}</span>
                <span className="text-blue-600">➔</span>
                <span>{selectedBooking.destinationCity || selectedBooking.destination}</span>
              </div>

              <div className="text-xs text-slate-600 font-mono flex items-center space-x-2">
                <span>PIN: {selectedBooking.origin} ➔ {selectedBooking.destination}</span>
                {selectedBooking.estimatedDistanceKm && (
                  <span className="text-slate-500 font-semibold">(~{selectedBooking.estimatedDistanceKm} km)</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Vehicle / Container</span>
                  <span className="font-semibold text-slate-900">{selectedBooking.vehicle_or_container || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Weight / Capacity</span>
                  <span className="font-semibold text-amber-700 font-mono">{selectedBooking.weight || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Material / Product</span>
                  <span className="font-semibold text-slate-800">{selectedBooking.material_or_line || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Loading Date & Slot</span>
                  <span className="text-slate-800">
                    {selectedBooking.loading_date} ({selectedBooking.time_slot || 'Anytime'})
                  </span>
                </div>
              </div>
            </div>

            {/* Shipper & Contacts */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Shipper Information
              </h4>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact Person:</span>
                  <span className="font-semibold text-slate-900">{selectedBooking.contact_name || '—'}</span>
                </div>
                {selectedBooking.company_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Company Name:</span>
                    <span className="font-semibold text-slate-900">{selectedBooking.company_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">WhatsApp Number:</span>
                  <span className="font-mono text-emerald-700 font-semibold">{formatPhone(selectedBooking.phone)}</span>
                </div>
                {selectedBooking.alternate_phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Alternate Number:</span>
                    <span className="font-mono text-slate-800 font-semibold">{formatPhone(selectedBooking.alternate_phone)}</span>
                  </div>
                )}
                {selectedBooking.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="text-slate-700">{selectedBooking.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks / Dispatcher Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Rate Quote & Internal Notes
                </h4>
                <button
                  onClick={handleSaveRemarks}
                  disabled={isSavingRemarks}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-60"
                >
                  {isSavingRemarks ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
              <textarea
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
                placeholder="Add quotation price (e.g. Quoted ₹42,000 for 21T Taurus), driver contact, or notes..."
                rows={3}
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Close Button */}
            <div className="pt-2 flex items-center justify-end border-t border-slate-200">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
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
