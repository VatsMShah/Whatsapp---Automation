import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  CheckCircle2,
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
  ChevronDown,
  ChevronUp,
  Sliders,
  Tag,
  Trash2,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Layers,
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
  assigned_subtypes: [],
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
  const [activeModalTab, setActiveModalTab] = useState<'profile' | 'vehicles'>('profile');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [isTriggeringAuto, setIsTriggeringAuto] = useState(false);
  const [customSubtypeInputs, setCustomSubtypeInputs] = useState<Record<string, string>>({});
  const [customSubtypesByVehicle, setCustomSubtypesByVehicle] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('traket_custom_subtypes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  // Vehicles collapsed by default for clean, uncluttered UX
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showForm && !isSaving) setShowForm(false);
        if (confirmDeactivate) setConfirmDeactivate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm, isSaving, confirmDeactivate]);

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
    setCustomSubtypeInputs({});
    setExpandedVehicles({}); // Start collapsed for clean, uncluttered UX
    setActiveModalTab('profile');
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
      assigned_subtypes: emp.assigned_subtypes || [],
    });
    setExpandedVehicles({});
    setCustomSubtypeInputs({});
    setActiveModalTab('profile');

    // Ensure any custom subtypes stored on the employee are visible in customSubtypesByVehicle
    if (emp.assigned_subtypes && emp.assigned_subtypes.length > 0) {
      setCustomSubtypesByVehicle((prev) => {
        const next = { ...prev };
        let changed = false;
        const allBuiltinIds = new Set(
          TRAKET_VEHICLES.flatMap((v) => v.subtypes.map((s) => s.id))
        );
        const assignedVehs = emp.assigned_vehicles || [];
        const defaultVeh = assignedVehs.length === 1 ? assignedVehs[0] : 'Truck';

        emp.assigned_subtypes?.forEach((st) => {
          if (!allBuiltinIds.has(st)) {
            const list = next[defaultVeh] || [];
            if (!list.includes(st)) {
              next[defaultVeh] = [...list, st];
              changed = true;
            }
          }
        });
        if (changed) {
          localStorage.setItem('traket_custom_subtypes', JSON.stringify(next));
        }
        return next;
      });
    }

    setShowPassword(false);
    setShowForm(true);
  };

  const toggleVehicle = (vehicleId: string) => {
    setForm((prev) => {
      const current = prev.assigned_vehicles || [];
      const exists = current.includes(vehicleId);
      if (exists) {
        const vehicleDef = TRAKET_VEHICLES.find((v) => v.id === vehicleId);
        const subIds = new Set([
          ...(vehicleDef?.subtypes.map((s) => s.id) || []),
          ...(customSubtypesByVehicle[vehicleId] || []),
        ]);
        return {
          ...prev,
          assigned_vehicles: current.filter((v) => v !== vehicleId),
          assigned_subtypes: (prev.assigned_subtypes || []).filter((s) => !subIds.has(s)),
        };
      } else {
        return {
          ...prev,
          assigned_vehicles: [...current, vehicleId],
        };
      }
    });
  };

  const toggleSubtype = (subtypeId: string, vehicleId?: string) => {
    setForm((prev) => {
      const current = prev.assigned_subtypes || [];
      const exists = current.includes(subtypeId);
      const newSubs = exists
        ? current.filter((s) => s !== subtypeId)
        : [...current, subtypeId];

      let newVehs = prev.assigned_vehicles || [];
      if (!exists && vehicleId && !newVehs.includes(vehicleId)) {
        newVehs = [...newVehs, vehicleId];
      }

      return {
        ...prev,
        assigned_vehicles: newVehs,
        assigned_subtypes: newSubs,
      };
    });
  };

  const selectVehicleAllSubtypes = (vehicleId: string) => {
    const vDef = TRAKET_VEHICLES.find((v) => v.id === vehicleId);
    if (!vDef) return;
    const builtInIds = vDef.subtypes.map((s) => s.id);
    const customIds = customSubtypesByVehicle[vehicleId] || [];
    const allIds = [...builtInIds, ...customIds];
    setForm((prev) => {
      const currentVehs = prev.assigned_vehicles || [];
      const newVehs = currentVehs.includes(vehicleId) ? currentVehs : [...currentVehs, vehicleId];
      return {
        ...prev,
        assigned_vehicles: newVehs,
        assigned_subtypes: Array.from(new Set([...(prev.assigned_subtypes || []), ...allIds])),
      };
    });
  };

  const clearVehicleSubtypes = (vehicleId: string) => {
    const vDef = TRAKET_VEHICLES.find((v) => v.id === vehicleId);
    if (!vDef) return;
    const builtInIds = new Set(vDef.subtypes.map((s) => s.id));
    const customIds = new Set(customSubtypesByVehicle[vehicleId] || []);
    setForm((prev) => ({
      ...prev,
      assigned_subtypes: (prev.assigned_subtypes || []).filter(
        (s) => !builtInIds.has(s) && !customIds.has(s)
      ),
    }));
  };

  const handleAddCustomSubtype = (vehicleId: string) => {
    const inputVal = (customSubtypeInputs[vehicleId] || '').trim();
    if (!inputVal) return;

    setCustomSubtypesByVehicle((prev) => {
      const list = prev[vehicleId] || [];
      if (list.includes(inputVal)) return prev;
      const updated = { ...prev, [vehicleId]: [...list, inputVal] };
      localStorage.setItem('traket_custom_subtypes', JSON.stringify(updated));
      return updated;
    });

    setForm((prev) => {
      const currentSubs = prev.assigned_subtypes || [];
      const currentVehs = prev.assigned_vehicles || [];
      const newVehs = currentVehs.includes(vehicleId) ? currentVehs : [...currentVehs, vehicleId];
      return {
        ...prev,
        assigned_vehicles: newVehs,
        assigned_subtypes: currentSubs.includes(inputVal) ? currentSubs : [...currentSubs, inputVal],
      };
    });

    setCustomSubtypeInputs((prev) => ({ ...prev, [vehicleId]: '' }));
  };

  const handleRemoveCustomSubtype = (vehicleId: string, subtypeName: string) => {
    setCustomSubtypesByVehicle((prev) => {
      const list = prev[vehicleId] || [];
      const updated = { ...prev, [vehicleId]: list.filter((s) => s !== subtypeName) };
      localStorage.setItem('traket_custom_subtypes', JSON.stringify(updated));
      return updated;
    });

    setForm((prev) => ({
      ...prev,
      assigned_subtypes: (prev.assigned_subtypes || []).filter((s) => s !== subtypeName),
    }));
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
      assigned_subtypes: [],
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

  // Render a clean vehicle card
  const renderVehicleCard = (vehicle: (typeof TRAKET_VEHICLES)[0]) => {
    const isSelected = (form.assigned_vehicles || []).includes(vehicle.id);
    const isExpanded = !!expandedVehicles[vehicle.id];
    const customSubs = customSubtypesByVehicle[vehicle.id] || [];
    const allSubIds = [...vehicle.subtypes.map((s) => s.id), ...customSubs];
    const selectedSubs = (form.assigned_subtypes || []).filter((s) => allSubIds.includes(s));

    return (
      <div
        key={vehicle.id}
        className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
          isSelected
            ? 'border-blue-500 bg-blue-50/25 shadow-xs ring-1 ring-blue-500/20'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
        }`}
      >
        {/* Card Header & Toggle */}
        <div
          className="p-3.5 flex items-start justify-between cursor-pointer select-none"
          onClick={() => toggleVehicle(vehicle.id)}
        >
          <div className="flex items-start space-x-3 min-w-0 flex-1">
            <div className="mt-0.5 shrink-0 text-blue-600">
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-300" />
              )}
            </div>
            <span className="text-2xl shrink-0 leading-none">{vehicle.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="font-bold text-xs text-slate-900">{vehicle.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">
                  {(vehicle as any).group || 'Fleet'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                {vehicle.desc}
              </p>
              {/* Capacity Status Pill */}
              <div className="mt-2 flex items-center space-x-2 flex-wrap gap-1">
                {isSelected ? (
                  selectedSubs.length === 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>All Capacities Covered</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      🎯 {selectedSubs.length} of {allSubIds.length} Sizes Selected
                    </span>
                  )
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Click to assign
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Fine-Tune Sizes Toggle Button (Only when selected) */}
          {isSelected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedVehicles((prev) => ({ ...prev, [vehicle.id]: !isExpanded }));
              }}
              className={`p-1.5 rounded-lg text-xs font-semibold shrink-0 ml-2 transition flex items-center space-x-1 ${
                isExpanded
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
              }`}
              title={isExpanded ? 'Done configuring sizes' : 'Restrict to specific sizes'}
            >
              <span className="text-[10px]">
                {isExpanded ? 'Done' : 'Fine-Tune'}
              </span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Expanded Fine-Tuning Drawer */}
        {isSelected && isExpanded && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700 flex items-center space-x-1">
                <Sliders className="w-3 h-3 text-blue-600" />
                <span>Allowed Sizes / Weights:</span>
              </span>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => selectVehicleAllSubtypes(vehicle.id)}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-blue-700 border border-slate-200 font-semibold"
                >
                  Select All ({allSubIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => clearVehicleSubtypes(vehicle.id)}
                  className="px-2 py-0.5 rounded bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 font-medium"
                  title="Clearing resets to cover all capacities automatically"
                >
                  Reset to All
                </button>
              </div>
            </div>

            {/* Subtypes Chips */}
            <div className="grid grid-cols-2 gap-1.5">
              {vehicle.subtypes.map((sub) => {
                const isSubSelected = (form.assigned_subtypes || []).includes(sub.id);
                return (
                  <button
                    type="button"
                    key={sub.id}
                    onClick={() => toggleSubtype(sub.id, vehicle.id)}
                    className={`p-2 rounded-xl border text-left transition flex items-center justify-between ${
                      isSubSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-400'
                        : 'bg-white text-slate-700 hover:bg-blue-50/50 hover:border-blue-200 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <span className="font-bold text-xs block truncate">{sub.label}</span>
                      {sub.size && (
                        <span
                          className={`text-[9px] block truncate font-mono ${
                            isSubSelected ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {sub.size}
                        </span>
                      )}
                    </div>
                    {isSubSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-white shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Subtypes Chips (if any) */}
            {customSubs.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Custom Added:</span>
                <div className="flex flex-wrap gap-1.5">
                  {customSubs.map((cSub) => {
                    const isCSubSelected = (form.assigned_subtypes || []).includes(cSub);
                    return (
                      <div
                        key={cSub}
                        onClick={() => toggleSubtype(cSub, vehicle.id)}
                        className={`px-2 py-0.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-1.5 transition ${
                          isCSubSelected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                        }`}
                      >
                        <span className="font-semibold text-[11px]">{cSub}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomSubtype(vehicle.id, cSub);
                          }}
                          className={`p-0.5 rounded hover:text-rose-400 ${
                            isCSubSelected ? 'text-indigo-200' : 'text-slate-400 hover:text-rose-600'
                          }`}
                          title="Delete custom subtype"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Custom Subtype Row */}
            <div className="pt-2 border-t border-slate-200 flex items-center space-x-1.5">
              <input
                type="text"
                value={customSubtypeInputs[vehicle.id] || ''}
                onChange={(e) =>
                  setCustomSubtypeInputs((prev) => ({ ...prev, [vehicle.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomSubtype(vehicle.id);
                  }
                }}
                placeholder={`+ Custom size for ${vehicle.label}...`}
                className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
              />
              <button
                type="button"
                onClick={() => handleAddCustomSubtype(vehicle.id)}
                disabled={!(customSubtypeInputs[vehicle.id] || '').trim()}
                className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    );
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
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition self-start sm:self-auto cursor-pointer"
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border shadow-sm cursor-pointer ${
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
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
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
            <span className="text-[10px] text-slate-400">Strict Auto-Routing: Specialists only receive assigned vehicle leads</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
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

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditForm(emp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Edit employee"
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

                  {/* Contact Info */}
                  <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
                    {emp.email && (
                      <div className="flex items-center space-x-2 truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{emp.email}</span>
                      </div>
                    )}
                    {emp.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono">{emp.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{emp.department || 'Operations'}</span>
                    </div>
                  </div>

                  {/* Assigned Vehicles & Specializations */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 flex items-center space-x-1">
                        <Truck className="w-3 h-3 text-blue-600" />
                        <span>Specializations ({vehicles.length}):</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {vehicles.length === 0 ? 'No vehicles' : 'Strict Match'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {vehicles.length > 0 ? (
                        vehicles.map((v) => {
                          const info = TRAKET_VEHICLES.find((tv) => tv.id === v);
                          const vSubtypeIds = info?.subtypes.map((s) => s.id) || [];
                          const customSubs = customSubtypesByVehicle[v] || [];
                          const allSubIds = [...vSubtypeIds, ...customSubs];
                          const selectedSubs = (emp.assigned_subtypes || []).filter((s) =>
                            allSubIds.includes(s) || (vehicles.length === 1 && !TRAKET_VEHICLES.flatMap((x) => x.subtypes.map((y) => y.id)).includes(s))
                          );

                          return (
                            <div key={v} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                              <div className="flex items-center justify-between font-bold text-slate-800">
                                <span className="flex items-center space-x-1.5 text-[11px]">
                                  <span>{info?.icon || '🚛'}</span>
                                  <span>{v}</span>
                                </span>
                                {selectedSubs.length === 0 ? (
                                  <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                                    All Sizes
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">
                                    {selectedSubs.length} Selected
                                  </span>
                                )}
                              </div>
                              {selectedSubs.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {selectedSubs.map((sub) => (
                                    <span
                                      key={sub}
                                      className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[9px] font-mono text-slate-700 font-medium"
                                    >
                                      {sub}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                          ⚠️ No vehicles assigned. Member will not receive auto-leads.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Password & Credential Box */}
                  <div className="mt-3 p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-600 font-mono">
                      <Key className="w-3 h-3 text-slate-400" />
                      <span>Password:</span>
                      <span className="font-bold text-slate-800">
                        {emp.password
                          ? isPassRevealed
                            ? emp.password
                            : '••••••••'
                          : '(not set)'}
                      </span>
                      {emp.password && (
                        <button
                          onClick={() => togglePasswordReveal(emp.employee_id)}
                          className="text-slate-400 hover:text-slate-600 ml-1 p-0.5"
                          title={isPassRevealed ? 'Hide' : 'Reveal'}
                        >
                          {isPassRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopyCredentials(emp)}
                      className={`text-[10px] font-bold px-2 py-1 rounded transition flex items-center space-x-1 ${
                        isCopied
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title="Copy credentials to send to employee"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Lead Metrics Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    Active Leads:{' '}
                    <span className="font-bold text-slate-900">{activeLeads}</span>
                  </div>
                  <div>
                    Lifetime Leads:{' '}
                    <span className="font-bold text-blue-600">{totalLeads}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inactive Employees Section */}
      {inactiveEmployees.length > 0 && (
        <div className="pt-4 border-t border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Deactivated Team Members ({inactiveEmployees.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {inactiveEmployees.map((emp) => (
              <div
                key={emp.employee_id}
                className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center space-x-2"
              >
                <span>{emp.name}</span>
                <span className="font-mono text-slate-400">({emp.employee_id})</span>
                <button
                  onClick={() => onSaveEmployee({ ...emp, is_active: true })}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold ml-1 cursor-pointer"
                  title="Reactivate"
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT EMPLOYEE MODAL (PORTALIZED FOR 100% BLUR) */}
      {/* ======================================================== */}
      {showForm &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSaving) setShowForm(false);
            }}
          >
            <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {editingEmployee ? 'Edit Team Member' : 'Add New Team Member'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Configure member profile, credentials & vehicle routing
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                      <Lock className="w-3 h-3 text-blue-500" />
                      <span>{form.employee_id}</span>
                    </span>
                    <button
                      onClick={() => setShowForm(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Segmented Tab Switcher */}
                <div className="flex items-center p-1 bg-slate-200/80 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('profile')}
                    className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer ${
                      activeModalTab === 'profile'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>1. Member Profile & Login</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModalTab('vehicles')}
                    className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer ${
                      activeModalTab === 'vehicles'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>2. Vehicle Routing ({(form.assigned_vehicles || []).length})</span>
                    {(form.assigned_vehicles || []).length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {activeModalTab === 'profile' ? (
                  /* ================= TAB 1: PROFILE & CREDENTIALS ================= */
                  <div className="space-y-4">
                    {/* Full Name & Department */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                          Full Name *
                        </label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Ramesh Patel"
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white placeholder:text-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                          Department
                        </label>
                        <div className="relative">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <select
                            value={form.department}
                            onChange={(e) => setForm({ ...form, department: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          >
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d} className="text-slate-900 bg-white">{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* System Role & Auto Employee ID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                          System Role
                        </label>
                        <div className="relative">
                          <Shield className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <select
                            value={form.role || 'employee'}
                            onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'employee' })}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="employee" className="text-slate-900 bg-white">Employee (Assigned Leads Only)</option>
                            <option value="admin" className="text-slate-900 bg-white">Admin (Full Access to All Leads)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                          Employee ID (Auto-Sequential)
                        </label>
                        <div className="relative">
                          <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={form.employee_id}
                            readOnly
                            disabled
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-800 cursor-not-allowed select-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                          Email ID (Username for Login)
                        </label>
                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="ramesh@traket.in"
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white placeholder:text-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                          Phone Number
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="+91 98765 43210"
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white placeholder:text-slate-400 font-mono font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Password with Auto-Generate */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1">
                          <Key className="w-3 h-3 text-blue-600" />
                          <span>Login Password / Access Key</span>
                        </label>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Auto-Generate</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password || ''}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder="Enter password or click Auto-Generate"
                          className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 bg-white placeholder:text-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        This password enables employee login to manage their assigned WhatsApp freight leads.
                      </p>
                    </div>

                    {/* Next Step Guidance Banner */}
                    <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-blue-900">
                        <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          <strong>Next Step:</strong> Assign which vehicle categories (Truck, Tempo, Container, FCL) this specialist handles.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveModalTab('vehicles')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 ml-3 flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Configure Vehicles</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ================= TAB 2: VEHICLE SPECIALIZATION ================= */
                  <div className="space-y-4">
                    {/* Quick Presets Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Fleet Presets:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={selectDomestic}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition cursor-pointer"
                        >
                          Domestic Fleet (4)
                        </button>
                        <button
                          type="button"
                          onClick={selectExim}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold border border-indigo-200 transition cursor-pointer"
                        >
                          EXIM / FCL (2)
                        </button>
                        <button
                          type="button"
                          onClick={selectAllVehicles}
                          className="px-2.5 py-1 rounded-lg bg-white text-slate-800 hover:bg-slate-100 font-bold border border-slate-200 shadow-2xs transition cursor-pointer"
                        >
                          All Fleet (6)
                        </button>
                        <button
                          type="button"
                          onClick={clearVehicles}
                          className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold transition cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Strict Auto-Routing Informational Pill */}
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900 leading-snug flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        <strong>Strict Auto-Routing:</strong> Specialists only receive incoming WhatsApp leads matching their checked vehicles. All capacities are covered by default unless fine-tuned.
                      </span>
                    </div>

                    {/* 6 Clean Vehicle Cards (2-column responsive grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {TRAKET_VEHICLES.map(renderVehicleCard)}
                    </div>

                    {(form.assigned_vehicles || []).length === 0 && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>No vehicles selected. This member will not receive any auto-routed leads.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sticky Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between">
                <div>
                  {(form.assigned_vehicles || []).length > 0 ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        <strong>{(form.assigned_vehicles || []).length} Vehicles</strong> assigned
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-600 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span>0 vehicles assigned</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  {activeModalTab === 'profile' ? (
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('vehicles')}
                      className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>Assign Vehicles</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('profile')}
                      className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
                    >
                      Back to Profile
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !form.name.trim() || !form.employee_id.trim()}
                    className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Employee'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* DEACTIVATE CONFIRM DIALOG (PORTALIZED FOR 100% BLUR) */}
      {/* ======================================================== */}
      {confirmDeactivate &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmDeactivate(null);
            }}
          >
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <UserX className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">Deactivate Employee?</div>
                  <div className="text-xs text-slate-500">Their past lead assignments will remain intact.</div>
                </div>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setConfirmDeactivate(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeactivate(confirmDeactivate)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
