import React, { useState } from 'react';
import {
  Users,
  Plus,
  UserCheck,
  UserX,
  Edit2,
  X,
  Save,
  Briefcase,
  Phone,
  Mail,
  Hash,
  CheckCircle,
  Lock,
  Key,
  Eye,
  EyeOff,
  Shield,
  User,
  Copy,
  Check,
  Sparkles,
  Truck,
  Zap,
  PauseCircle,
  PlayCircle,
  CheckSquare,
  Square,
  Package,
} from 'lucide-react';
import { Employee, FreightBooking, LeadAssignment, TRAKET_VEHICLES, TraketVehicleType } from '../../types';

interface TeamManagerProps {
  employees: Employee[];
  bookings: FreightBooking[];
  assignments: Record<string, LeadAssignment>;
  onSaveEmployee: (emp: Omit<Employee, 'id' | 'created_at'>) => Promise<void>;
  onDeactivateEmployee: (employeeId: string) => Promise<void>;
  isAutoAssignEnabled?: boolean;
  onToggleAutoAssign?: (enabled: boolean) => void;
  onTriggerAutoAssign?: () => Promise<void>;
}

const DEPARTMENTS = ['Sales', 'Operations', 'Support', 'Finance', 'Management'];

// Helper to compute sequential employee ID based on existing count/max number
export const getNextEmployeeId = (list: Employee[]): string => {
  const nums = list
    .map((e) => {
      const match = e.employee_id?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter((n) => !isNaN(n) && n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `EMP${String(max + 1).padStart(3, '0')}`;
};

const emptyForm = (nextId = ''): Omit<Employee, 'id' | 'created_at'> => ({
  employee_id: nextId,
  name: '',
  email: '',
  phone: '',
  department: 'Sales',
  role: 'employee',
  password: '',
  is_active: true,
  assigned_vehicles: ['Truck', 'Tempo'], // default vehicle types provided by Traket
});

export const TeamManager: React.FC<TeamManagerProps> = ({
  employees,
  bookings,
  assignments,
  onSaveEmployee,
  onDeactivateEmployee,
  isAutoAssignEnabled = true,
  onToggleAutoAssign,
  onTriggerAutoAssign,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [isTriggeringAuto, setIsTriggeringAuto] = useState(false);

  // Count leads per employee
  const leadsPerEmployee = (employeeId: string) => {
    return Object.values(assignments).filter((a) => a.assigned_to === employeeId).length;
  };

  const activeLeadsPerEmployee = (employeeId: string) => {
    return Object.values(assignments).filter((a) => {
      if (a.assigned_to !== employeeId) return false;
      const booking = bookings.find((b) => b.user_id === a.user_id);
      return booking && !['completed', 'cancelled'].includes(booking.status);
    }).length;
  };

  const openAddForm = () => {
    const nextId = getNextEmployeeId(employees);
    setEditingEmployee(null);
    setForm(emptyForm(nextId));
    setShowPassword(false);
    setShowForm(true);
  };

  const openEditForm = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      employee_id: emp.employee_id,
      name: emp.name,
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || 'Sales',
      role: emp.role || 'employee',
      password: emp.password || '',
      is_active: emp.is_active,
      assigned_vehicles: emp.assigned_vehicles || [],
    });
    setShowPassword(false);
    setShowForm(true);
  };

  const toggleVehicle = (vehicleId: string) => {
    setForm((prev) => {
      const current = prev.assigned_vehicles || [];
      const exists = current.includes(vehicleId);
      return {
        ...prev,
        assigned_vehicles: exists ? current.filter((v) => v !== vehicleId) : [...current, vehicleId],
      };
    });
  };

  const selectDomestic = () => {
    const domesticIds = TRAKET_VEHICLES.filter((v) => (v as any).group === 'Domestic').map((v) => v.id);
    setForm((prev) => {
      const current = prev.assigned_vehicles || [];
      return { ...prev, assigned_vehicles: Array.from(new Set([...current, ...domesticIds])) };
    });
  };

  const selectExim = () => {
    const eximIds = TRAKET_VEHICLES.filter((v) => (v as any).group === 'EXIM / FCL').map((v) => v.id);
    setForm((prev) => {
      const current = prev.assigned_vehicles || [];
      return { ...prev, assigned_vehicles: Array.from(new Set([...current, ...eximIds])) };
    });
  };

  const selectAllVehicles = () => {
    setForm((prev) => ({
      ...prev,
      assigned_vehicles: TRAKET_VEHICLES.map((v) => v.id),
    }));
  };

  const clearVehicles = () => {
    setForm((prev) => ({
      ...prev,
      assigned_vehicles: [],
    }));
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'Tk#';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, password: pass }));
    setShowPassword(true);
  };

  const handleCopyCredentials = (emp: Employee) => {
    const text = `Traket Login Credentials:\nEmployee ID: ${emp.employee_id}\nName: ${emp.name}\nEmail: ${emp.email || 'N/A'}\nPassword: ${emp.password || '(not set)'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(emp.employee_id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const togglePasswordReveal = (empId: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [empId]: !prev[empId] }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.employee_id.trim()) return;
    setIsSaving(true);
    await onSaveEmployee(form);
    setIsSaving(false);
    setShowForm(false);
  };

  const handleDeactivate = async (employeeId: string) => {
    await onDeactivateEmployee(employeeId);
    setConfirmDeactivate(null);
  };

  const handleTriggerAuto = async () => {
    if (!onTriggerAutoAssign) return;
    setIsTriggeringAuto(true);
    await onTriggerAutoAssign();
    setIsTriggeringAuto(false);
  };

  const activeEmployees = employees.filter((e) => e.is_active);
  const inactiveEmployees = employees.filter((e) => !e.is_active);
  const nextSequentialId = getNextEmployeeId(employees);

  // Count unassigned bookings
  const unassignedCount = bookings.filter((b) => !assignments[b.user_id]?.assigned_to).length;

  // Count specialists per vehicle
  const getSpecialistCount = (vehicleId: string) => {
    return activeEmployees.filter(
      (e) => e.assigned_vehicles && e.assigned_vehicles.includes(vehicleId)
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Team & Vehicle Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin control for vehicle assignment, auto-routing leads, and employee permissions
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Top Banner: Vehicle-Based Auto Lead Assignment Control Center */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl text-white shadow-md border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-200 text-[10px] font-bold tracking-wider uppercase border border-blue-400/30 flex items-center space-x-1">
                <Truck className="w-3 h-3 text-blue-300" />
                <span>Vehicle Lead Routing Engine</span>
              </span>
              <span
                className={`text-[11px] font-semibold flex items-center space-x-1.5 px-2 py-0.5 rounded-full ${
                  isAutoAssignEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAutoAssignEnabled ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                  }`}
                />
                <span>{isAutoAssignEnabled ? 'AUTO-LEAD: ACTIVE (Vehicle-Based)' : 'AUTO-LEAD: PAUSED (Manual Mode)'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When <strong>Active</strong>, new leads for <strong>Truck</strong>, <strong>Tempo</strong>, <strong>Container</strong>, or <strong>Trailer</strong> are automatically assigned to the designated vehicle specialist. You can pause anytime to assign leads manually.
            </p>
          </div>

          {/* Controls: Pause / Resume Toggle & Run Auto Assign */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Pause / Convert to Manual Toggle */}
            <button
              onClick={() => onToggleAutoAssign && onToggleAutoAssign(!isAutoAssignEnabled)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border shadow-sm ${
                isAutoAssignEnabled
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              }`}
            >
              {isAutoAssignEnabled ? (
                <>
                  <PauseCircle className="w-4 h-4 text-amber-300" />
                  <span>Pause Auto-Lead (Manual Mode)</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 text-emerald-300" />
                  <span>Resume Auto-Lead</span>
                </>
              )}
            </button>

            {/* Run Auto Assign Button */}
            <button
              onClick={handleTriggerAuto}
              disabled={isTriggeringAuto || unassignedCount === 0}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 transition shadow-sm"
              title="Automatically assign all currently unassigned freight leads based on vehicle matching"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{isTriggeringAuto ? 'Assigning...' : `Auto-Assign Pending (${unassignedCount})`}</span>
            </button>
          </div>
        </div>

        {/* Vehicle Specialists Breakdown Row */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
            <span>Specialists by Vehicle Category</span>
            <span className="text-[10px] text-slate-400">Strict Auto-Routing: Truck specialists only receive Truck leads</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {TRAKET_VEHICLES.map((v) => {
              const count = getSpecialistCount(v.id);
              return (
                <div
                  key={v.id}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-base shrink-0">{v.icon}</span>
                    <div className="min-w-0">
                      <span className="font-bold text-white text-xs block truncate">{v.label}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{(v as any).group || 'Fleet'}</span>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ml-1 ${
                      count > 0 ? 'bg-blue-500/30 text-blue-200' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {count} Active
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Team Members', value: employees.length, color: 'blue' },
          { label: 'Active Specialists', value: activeEmployees.length, color: 'emerald' },
          { label: 'Total Assigned Leads', value: Object.keys(assignments).length, color: 'violet' },
          { label: 'Pending Unassigned Leads', value: unassignedCount, color: unassignedCount > 0 ? 'amber' : 'slate' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-xl border bg-${stat.color}-50/60 border-${stat.color}-200`}
          >
            <div className={`text-2xl font-extrabold text-${stat.color}-700`}>{stat.value}</div>
            <div className={`text-xs font-semibold text-${stat.color}-600 mt-0.5`}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Active Employees Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active Team Members ({activeEmployees.length})
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            Next Available ID: <span className="font-mono font-bold text-blue-600">{nextSequentialId}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeEmployees.map((emp) => {
            const totalLeads = leadsPerEmployee(emp.employee_id);
            const activeLeads = activeLeadsPerEmployee(emp.employee_id);
            const isCopied = copiedId === emp.employee_id;
            const isPassRevealed = !!revealedPasswords[emp.employee_id];
            const vehicles = emp.assigned_vehicles || [];

            return (
              <div
                key={emp.employee_id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow space-y-3 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0">
                        {emp.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                            {emp.employee_id}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                              emp.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {emp.role || 'employee'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditForm(emp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Edit employee and vehicle specialization"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeactivate(emp.employee_id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Deactivate employee"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Specialization Badges */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Assigned Vehicles:</span>
                      <span className="text-[9px] text-blue-600 font-semibold">
                        {vehicles.length} vehicle type{vehicles.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {vehicles.length > 0 ? (
                        vehicles.map((v) => {
                          const info = TRAKET_VEHICLES.find((tv) => tv.id === v);
                          return (
                            <span
                              key={v}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200"
                            >
                              <span>{info?.icon || '🚛'}</span>
                              <span>{v}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span>🌐 General Pool (All Vehicles)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                    {emp.department && (
                      <div className="flex items-center space-x-1.5">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.department}</span>
                      </div>
                    )}
                    {emp.email && (
                      <div className="flex items-center space-x-1.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{emp.email}</span>
                      </div>
                    )}
                    {emp.phone && (
                      <div className="flex items-center space-x-1.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.phone}</span>
                      </div>
                    )}

                    {/* Password display & quick copy */}
                    <div className="flex items-center justify-between bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 mt-2">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] text-slate-500 font-mono truncate">
                          {emp.password
                            ? isPassRevealed
                              ? emp.password
                              : '••••••••'
                            : 'No password set'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {emp.password && (
                          <button
                            onClick={() => togglePasswordReveal(emp.employee_id)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                            title={isPassRevealed ? 'Hide' : 'Reveal'}
                          >
                            {isPassRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleCopyCredentials(emp)}
                          className="flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 hover:text-blue-600 bg-white rounded border border-slate-200"
                          title="Copy login details"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-2.5 h-2.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lead Stats */}
                <div className="flex items-center space-x-2 pt-3 border-t border-slate-100 mt-3">
                  <div className="flex-1 text-center">
                    <div className="text-lg font-extrabold text-blue-700">{totalLeads}</div>
                    <div className="text-[9px] font-semibold text-slate-500 uppercase">Total Leads</div>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="flex-1 text-center">
                    <div className="text-lg font-extrabold text-emerald-600">{activeLeads}</div>
                    <div className="text-[9px] font-semibold text-slate-500 uppercase">Active</div>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="flex-1 text-center">
                    <div className="text-lg font-extrabold text-slate-500">{totalLeads - activeLeads}</div>
                    <div className="text-[9px] font-semibold text-slate-500 uppercase">Closed</div>
                  </div>
                </div>
              </div>
            );
          })}

          {activeEmployees.length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">No Team Members In Database</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Add team members and assign their vehicle specializations (Truck, Tempo, Container, Trailer) to enable automated lead routing.
              </p>
              <button
                onClick={openAddForm}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Employee ({nextSequentialId})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inactive Employees */}
      {inactiveEmployees.length > 0 && (
        <div className="pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Inactive / Deactivated ({inactiveEmployees.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {inactiveEmployees.map((emp) => (
              <div
                key={emp.employee_id}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500"
              >
                <UserX className="w-3 h-3 text-slate-400" />
                <span>{emp.name}</span>
                <span className="font-mono text-slate-400">({emp.employee_id})</span>
                <button
                  onClick={() => onSaveEmployee({ ...emp, is_active: true })}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold ml-1"
                  title="Reactivate"
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Modal with Vehicle Management Option */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <span>{editingEmployee ? 'Edit Team Member & Vehicles' : 'Add New Team Member'}</span>
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Employee ID & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">
                      Employee ID
                    </label>
                    <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded flex items-center space-x-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Auto</span>
                    </span>
                  </div>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={form.employee_id}
                      readOnly
                      disabled
                      title="Auto-generated sequential ID based on existing team member count"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700 cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    System Role
                  </label>
                  <select
                    value={form.role || 'employee'}
                    onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'employee' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="employee">Employee (Assigned Leads)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </div>
              </div>

              {/* Department & Full Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Email ID (Username for Login)
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="ramesh@traket.in"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* ======================================================== */}
              {/* VEHICLE MANAGEMENT OPTION: SELECT WHICH TRAKET PROVIDES */}
              {/* ======================================================== */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Vehicle Management & Specialization
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={selectDomestic}
                      className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200"
                    >
                      Domestic Only
                    </button>
                    <button
                      type="button"
                      onClick={selectExim}
                      className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold border border-indigo-200"
                    >
                      EXIM / FCL Only
                    </button>
                    <button
                      type="button"
                      onClick={selectAllVehicles}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                    >
                      All Vehicles
                    </button>
                    <button
                      type="button"
                      onClick={clearVehicles}
                      className="px-2 py-0.5 rounded text-rose-600 hover:bg-rose-50 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-900 leading-snug">
                  <strong>🔒 Strict Lead Matching:</strong> Employees only receive leads matching their selected vehicle types. For example, if only <em>Truck</em> is checked, they will never receive FCL, HCL, or Tempo leads.
                </div>

                {/* Group 1: Domestic Fleet */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>🚛 Domestic Fleet (Road Logistics)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {TRAKET_VEHICLES.filter((v) => (v as any).group === 'Domestic').map((vehicle) => {
                      const isSelected = (form.assigned_vehicles || []).includes(vehicle.id);
                      return (
                        <div
                          key={vehicle.id}
                          onClick={() => toggleVehicle(vehicle.id)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-start space-x-2 ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-500 text-blue-950 ring-1 ring-blue-500/30 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-xl shrink-0 mt-0.5">{vehicle.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs">{vehicle.label}</span>
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-1" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 block">
                              {vehicle.desc}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Group 2: EXIM & FCL Container Fleet */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>🚢 EXIM & Container Fleet (Port / CFS Logistics)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {TRAKET_VEHICLES.filter((v) => (v as any).group === 'EXIM / FCL').map((vehicle) => {
                      const isSelected = (form.assigned_vehicles || []).includes(vehicle.id);
                      return (
                        <div
                          key={vehicle.id}
                          onClick={() => toggleVehicle(vehicle.id)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-start space-x-2 ${
                            isSelected
                              ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500/30 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-xl shrink-0 mt-0.5">{vehicle.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs">{vehicle.label}</span>
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-1" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 block">
                              {vehicle.desc}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(form.assigned_vehicles || []).length === 0 && (
                  <p className="text-[10px] text-amber-600 font-medium italic">
                    ⚠️ No vehicle selected: this member will not receive any auto-routed leads.
                  </p>
                )}
              </div>

              {/* Password with Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Password / Access Key
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password || ''}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Set password or click Auto-Generate"
                    className="w-full pl-8 pr-16 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Stored securely so the employee can log in when authentication is active.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.name.trim() || !form.employee_id.trim()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Employee'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirm Dialog */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Deactivate Employee?</div>
                <div className="text-xs text-slate-500">Their lead assignments will remain intact.</div>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeactivate(confirmDeactivate)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
