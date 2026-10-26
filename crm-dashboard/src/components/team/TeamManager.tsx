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
} from 'lucide-react';
import { Employee, FreightBooking, LeadAssignment } from '../../types';

interface TeamManagerProps {
  employees: Employee[];
  bookings: FreightBooking[];
  assignments: Record<string, LeadAssignment>;
  onSaveEmployee: (emp: Omit<Employee, 'id' | 'created_at'>) => Promise<void>;
  onDeactivateEmployee: (employeeId: string) => Promise<void>;
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
});

export const TeamManager: React.FC<TeamManagerProps> = ({
  employees,
  bookings,
  assignments,
  onSaveEmployee,
  onDeactivateEmployee,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

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
    });
    setShowPassword(false);
    setShowForm(true);
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

  const activeEmployees = employees.filter((e) => e.is_active);
  const inactiveEmployees = employees.filter((e) => !e.is_active);
  const nextSequentialId = getNextEmployeeId(employees);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Team Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin control for employee credentials, auto-generated IDs, and lead assignment permissions
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

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Team Members', value: employees.length, color: 'blue' },
          { label: 'Active Members', value: activeEmployees.length, color: 'emerald' },
          { label: 'Total Assigned Leads', value: Object.keys(assignments).length, color: 'violet' },
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
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{emp.name}</div>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                            {emp.employee_id}
                          </span>
                          {emp.role === 'admin' ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center space-x-0.5">
                              <Shield className="w-2.5 h-2.5" />
                              <span>Admin</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center space-x-0.5">
                              <User className="w-2.5 h-2.5" />
                              <span>Employee</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
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
                All initial dummy employee seeds have been cleared. Employees are now only created when you as an Admin add them.
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

      {/* Inactive Employees (collapsed) */}
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

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <span>{editingEmployee ? 'Edit Team Member' : 'Add New Team Member'}</span>
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5">
              {/* Employee ID (Auto-Generated & Locked) */}
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
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-200">
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
