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
  Search,
  Filter,
  Clock,
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

  // Quick search and filtering for intuitive team browsing
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

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

  const domesticVehicles = TRAKET_VEHICLES.filter((v) => (v as any).group === 'Domestic');
  const domesticIds = domesticVehicles.map((v) => v.id);
  const isDomesticSelected =
    domesticIds.length > 0 && domesticIds.every((id) => (form.assigned_vehicles || []).includes(id));

  const eximVehicles = TRAKET_VEHICLES.filter((v) => (v as any).group === 'EXIM / FCL');
  const eximIds = eximVehicles.map((v) => v.id);
  const isEximSelected =
    eximIds.length > 0 && eximIds.every((id) => (form.assigned_vehicles || []).includes(id));

  const isAllSelected =
    TRAKET_VEHICLES.length > 0 && TRAKET_VEHICLES.every((v) => (form.assigned_vehicles || []).includes(v.id));

  const toggleDomestic = () => {
    setForm((prev) => {
      const current = prev.assigned_vehicles || [];
      const alreadySelected = domesticIds.every((id) => current.includes(id));
      if (alreadySelected) {
        // Unselect all domestic vehicles and remove their subtypes
        const domesticSubIds = new Set(
          domesticVehicles.flatMap((v) => [
            ...v.subtypes.map((s) => s.id),
            ...(customSubtypesByVehicle[v.id] || []),
          ])
        );
        return {
          ...prev,
          assigned_vehicles: current.filter((id) => !(domesticIds as string[]).includes(id)),
          assigned_subtypes: (prev.assigned_subtypes || []).filter((s) => !domesticSubIds.has(s)),
        };
      } else {
        // Select all domestic vehicles
        return {
          ...prev,
          assigned_vehicles: Array.from(new Set([...current, ...domesticIds])),
        };
      }
    });
  };

  const toggleExim = () => {
    setForm((prev) => {
      const current = prev.assigned_vehicles || [];
      const alreadySelected = eximIds.every((id) => current.includes(id));
      if (alreadySelected) {
        // Unselect all EXIM vehicles and remove their subtypes
        const eximSubIds = new Set(
          eximVehicles.flatMap((v) => [
            ...v.subtypes.map((s) => s.id),
            ...(customSubtypesByVehicle[v.id] || []),
          ])
        );
        return {
          ...prev,
          assigned_vehicles: current.filter((id) => !(eximIds as string[]).includes(id)),
          assigned_subtypes: (prev.assigned_subtypes || []).filter((s) => !eximSubIds.has(s)),
        };
      } else {
        // Select all EXIM vehicles
        return {
          ...prev,
          assigned_vehicles: Array.from(new Set([...current, ...eximIds])),
        };
      }
    });
  };

  const selectAllVehicles = () => {
    setForm((prev) => ({
      ...prev,
      assigned_vehicles: TRAKET_VEHICLES.map((v) => v.id),
    }));
  };

  const toggleAllVehicles = () => {
    if (isAllSelected) {
      clearVehicles();
    } else {
      selectAllVehicles();
    }
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

  // Capitalize name cleanly for better readability (e.g. "preet" -> "Preet", "RAMU" -> "Ramu")
  const formatName = (name: string) => {
    if (!name) return 'Team Member';
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const handleCopyCredentials = (emp: Employee) => {
    const text = `Traket Transport CRM Access:
------------------------------------
Employee Name : ${formatName(emp.name)}
Employee ID   : ${emp.employee_id}
Username/Email: ${emp.email || 'N/A'}
Phone         : ${emp.phone || 'N/A'}
Password      : ${emp.password || '(not set)'}
Department    : ${emp.department || 'Operations'}
Specializations: ${(emp.assigned_vehicles || []).join(', ') || 'None'}
------------------------------------
Portal URL    : ${window.location.origin}`;
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

  const employeesWithoutVehicles = activeEmployees.filter(
    (e) => !e.assigned_vehicles || e.assigned_vehicles.length === 0
  );

  const filteredEmployees = activeEmployees.filter((emp) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (emp.name || '').toLowerCase().includes(q);
      const matchId = (emp.employee_id || '').toLowerCase().includes(q);
      const matchEmail = (emp.email || '').toLowerCase().includes(q);
      const matchPhone = (emp.phone || '').includes(q);
      const matchDept = (emp.department || '').toLowerCase().includes(q);
      const matchVeh = (emp.assigned_vehicles || []).some((v) => v.toLowerCase().includes(q));
      if (!matchName && !matchId && !matchEmail && !matchPhone && !matchDept && !matchVeh) {
        return false;
      }
    }

    if (selectedVehicleFilter !== 'all') {
      if (selectedVehicleFilter === 'unassigned') {
        if ((emp.assigned_vehicles || []).length > 0) return false;
      } else if (selectedVehicleFilter === 'domestic') {
        const domesticIds = ['Tempo', 'Truck', 'Container (Domestic)', 'Trailer / ODC'];
        const hasDomestic = (emp.assigned_vehicles || []).some((v) => domesticIds.includes(v));
        if (!hasDomestic) return false;
      } else if (selectedVehicleFilter === 'exim') {
        const eximIds = ['FCL 20', 'FCL 40'];
        const hasExim = (emp.assigned_vehicles || []).some((v) => eximIds.includes(v));
        if (!hasExim) return false;
      } else {
        if (!(emp.assigned_vehicles || []).includes(selectedVehicleFilter)) return false;
      }
    }

    if (selectedDeptFilter !== 'all') {
      if (emp.department !== selectedDeptFilter) return false;
    }

    return true;
  });

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
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Team & Vehicle Management</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign vehicle specializations, manage credentials, and control automatic WhatsApp lead routing
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team Member</span>
        </button>
      </div>

      {/* Vehicle-Based Auto Lead Assignment Control Center */}
      <div className="p-5 bg-white rounded-2xl shadow-xs border border-slate-200/90 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider border border-blue-200 flex items-center space-x-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>Lead Routing Engine</span>
              </span>
              <span
                className={`text-xs font-bold flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full ${
                  isAutoAssignEnabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAutoAssignEnabled ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                  }`}
                />
                <span>{isAutoAssignEnabled ? 'Auto-Dispatch: ACTIVE' : 'Auto-Dispatch: PAUSED (Manual Mode)'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              When <strong>Active</strong>, incoming WhatsApp leads for <strong>Truck</strong>, <strong>Tempo</strong>, <strong>Container</strong>, <strong>Trailer</strong> & <strong>FCL</strong> are instantly routed to specialists handling those vehicles.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            {/* Pause / Resume Toggle */}
            <button
              type="button"
              onClick={() => onToggleAutoAssign && onToggleAutoAssign(!isAutoAssignEnabled)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border shadow-2xs cursor-pointer ${
                isAutoAssignEnabled
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
              }`}
            >
              {isAutoAssignEnabled ? (
                <>
                  <PauseCircle className="w-4 h-4 text-amber-600" />
                  <span>Pause Auto-Routing</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 text-white" />
                  <span>Resume Auto-Routing</span>
                </>
              )}
            </button>

            {/* Run Auto Assign Button */}
            <button
              type="button"
              onClick={handleTriggerAuto}
              disabled={isTriggeringAuto || unassignedCount === 0}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
              title="Automatically match and assign pending freight leads"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{isTriggeringAuto ? 'Assigning...' : `Auto-Assign Pending (${unassignedCount})`}</span>
            </button>
          </div>
        </div>

        {/* Vehicle Specialists Breakdown Row (Clickable Filter Chips!) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-700">Specialist Coverage by Vehicle Category:</span>
            <span className="text-[11px] text-slate-400">Click any card to filter team members</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {TRAKET_VEHICLES.map((v) => {
              const count = getSpecialistCount(v.id);
              const isFiltered = selectedVehicleFilter === v.id;
              const shortLabel = v.id === 'Container (Domestic)' ? 'Container' : v.label;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVehicleFilter(isFiltered ? 'all' : v.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isFiltered
                      ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-xl shrink-0 leading-none">{v.icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 text-xs block truncate" title={v.label}>
                        {shortLabel}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {(v as any).group || 'Fleet'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        count > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {count > 0 ? `✓ ${count} Active` : '0 Active'}
                    </span>
                    {isFiltered && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1 rounded">Filtered</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Team</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{employees.length}</div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1">
            <span>{activeEmployees.length} Active</span>
            <span>•</span>
            <span>{inactiveEmployees.length} Inactive</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Active Specialists</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{activeEmployees.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Ready for auto-routing</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Assigned Leads</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-2">{Object.keys(assignments).length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Handled across fleet</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Pending Leads</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold mt-2 ${unassignedCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {unassignedCount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {unassignedCount > 0 ? 'Awaiting assignment' : 'All leads assigned'}
          </div>
        </div>
      </div>

      {/* Active Team Members Section */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Active Team Members ({filteredEmployees.length})
            </h3>
            {filteredEmployees.length !== activeEmployees.length && (
              <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Filtered from {activeEmployees.length}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500">
            Next Employee ID:{' '}
            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {nextSequentialId}
            </span>
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member by name, ID, phone, email, vehicle..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedVehicleFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                selectedVehicleFilter === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              All Fleet ({activeEmployees.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedVehicleFilter(selectedVehicleFilter === 'domestic' ? 'all' : 'domestic')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                selectedVehicleFilter === 'domestic'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              Domestic Fleet
            </button>
            <button
              type="button"
              onClick={() => setSelectedVehicleFilter(selectedVehicleFilter === 'exim' ? 'all' : 'exim')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                selectedVehicleFilter === 'exim'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              EXIM / FCL
            </button>
            {employeesWithoutVehicles.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedVehicleFilter(selectedVehicleFilter === 'unassigned' ? 'all' : 'unassigned')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                  selectedVehicleFilter === 'unassigned'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                }`}
              >
                No Vehicles ({employeesWithoutVehicles.length})
              </button>
            )}
            {(selectedVehicleFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedVehicleFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Member Cards Grid */}
        {filteredEmployees.length === 0 ? (
          <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">No team members found</h4>
              <p className="text-xs text-slate-500 mt-1">
                No specialists matched your current search query or fleet filter.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedVehicleFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => {
              const totalLeads = leadsPerEmployee(emp.employee_id);
              const activeLeads = activeLeadsPerEmployee(emp.employee_id);
              const isCopied = copiedId === emp.employee_id;
              const isPassRevealed = !!revealedPasswords[emp.employee_id];
              const vehicles = emp.assigned_vehicles || [];
              const formattedName = formatName(emp.name);

              return (
                <div
                  key={emp.employee_id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-xs shrink-0">
                          {emp.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm tracking-tight">{formattedName}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                              {emp.employee_id}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                emp.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {emp.role === 'admin' ? 'Admin' : 'Specialist'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Edit profile & vehicle routing"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeactivate(emp.employee_id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Deactivate specialist"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100 mt-3">
                      <div className="flex items-center space-x-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{emp.email || <span className="italic text-slate-400">No email set</span>}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{emp.phone || <span className="italic text-slate-400">No phone set</span>}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700">{emp.department || 'Operations'}</span>
                      </div>
                    </div>

                    {/* Assigned Vehicles & Specializations */}
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center space-x-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Routing Specializations ({vehicles.length})</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {vehicles.length === 0 ? 'No vehicles' : 'Strict Auto-Match'}
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
                                  <span className="flex items-center space-x-1.5 text-xs">
                                    <span>{info?.icon || '🚛'}</span>
                                    <span>{v}</span>
                                  </span>
                                  {selectedSubs.length === 0 ? (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                      All Capacities
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                                      {selectedSubs.length} Selected
                                    </span>
                                  )}
                                </div>
                                {selectedSubs.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {selectedSubs.map((sub) => (
                                      <span
                                        key={sub}
                                        className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-700 font-medium"
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
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>No vehicles assigned</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEmployee(emp);
                                setForm({
                                  employee_id: emp.employee_id,
                                  name: emp.name,
                                  email: emp.email || '',
                                  phone: emp.phone || '',
                                  department: emp.department || 'Sales',
                                  role: emp.role || 'employee',
                                  password: emp.password || '',
                                  is_active: emp.is_active ?? true,
                                  assigned_vehicles: emp.assigned_vehicles || [],
                                  assigned_subtypes: emp.assigned_subtypes || [],
                                });
                                setActiveModalTab('vehicles');
                                setShowForm(true);
                              }}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                            >
                              Configure
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Password & Credentials Box */}
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5 text-slate-600 font-mono">
                        <Key className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 font-sans text-[11px]">Pass:</span>
                        <span className="font-bold text-slate-800">
                          {emp.password
                            ? isPassRevealed
                              ? emp.password
                              : '••••••••'
                            : '(not set)'}
                        </span>
                        {emp.password && (
                          <button
                            type="button"
                            onClick={() => togglePasswordReveal(emp.employee_id)}
                            className="text-slate-400 hover:text-slate-600 ml-1 p-0.5 cursor-pointer"
                            title={isPassRevealed ? 'Hide password' : 'Show password'}
                          >
                            {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCredentials(emp)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition flex items-center space-x-1 cursor-pointer border ${
                          isCopied
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                        }`}
                        title="Copy login details to send to specialist"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Share Login</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Lead Metrics Footer */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center space-x-1">
                      <span>Active Leads:</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded font-mono">{activeLeads}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>Lifetime Leads:</span>
                      <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-mono">{totalLeads}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                          onClick={toggleDomestic}
                          className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer flex items-center space-x-1 ${
                            isDomesticSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs hover:bg-blue-700'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          {isDomesticSelected && <Check className="w-3 h-3" />}
                          <span>Domestic Fleet (4)</span>
                        </button>
                        <button
                          type="button"
                          onClick={toggleExim}
                          className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer flex items-center space-x-1 ${
                            isEximSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs hover:bg-indigo-700'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          {isEximSelected && <Check className="w-3 h-3" />}
                          <span>EXIM / FCL (2)</span>
                        </button>
                        <button
                          type="button"
                          onClick={toggleAllVehicles}
                          className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer flex items-center space-x-1 ${
                            isAllSelected
                              ? 'bg-slate-800 text-white border-slate-800 shadow-xs hover:bg-slate-900'
                              : 'bg-white text-slate-800 hover:bg-slate-100 border-slate-300 shadow-2xs'
                          }`}
                        >
                          {isAllSelected && <Check className="w-3 h-3" />}
                          <span>All Fleet (6)</span>
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

                  {activeModalTab === 'vehicles' && (
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
