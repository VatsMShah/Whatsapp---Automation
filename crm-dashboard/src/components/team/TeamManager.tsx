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

const emptyForm = (): Omit<Employee, 'id' | 'created_at'> => ({
  employee_id: '',
  name: '',
  email: '',
  phone: '',
  department: 'Sales',
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
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

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
    setEditingEmployee(null);
    setForm(emptyForm());
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
      is_active: emp.is_active,
    });
    setShowForm(true);
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

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Team Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your sales & operations team members and their lead assignments
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Employees', value: employees.length, color: 'blue' },
          { label: 'Active Members', value: activeEmployees.length, color: 'emerald' },
          { label: 'Total Assigned Leads', value: Object.keys(assignments).length, color: 'violet' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-xl border bg-${stat.color}-50 border-${stat.color}-200`}
          >
            <div className={`text-2xl font-extrabold text-${stat.color}-700`}>{stat.value}</div>
            <div className={`text-xs font-semibold text-${stat.color}-600 mt-0.5`}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Active Employees Grid */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Active Team Members ({activeEmployees.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeEmployees.map((emp) => {
            const totalLeads = leadsPerEmployee(emp.employee_id);
            const activeLeads = activeLeadsPerEmployee(emp.employee_id);
            return (
              <div
                key={emp.employee_id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow space-y-3"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                      {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                        {emp.employee_id}
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

                {/* Info */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  {emp.department && (
                    <div className="flex items-center space-x-1.5">
                      <Briefcase className="w-3 h-3 text-slate-400" />
                      <span>{emp.department}</span>
                    </div>
                  )}
                  {emp.email && (
                    <div className="flex items-center space-x-1.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center space-x-1.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                </div>

                {/* Lead Stats */}
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
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
            <div className="col-span-3 py-12 text-center text-slate-500">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold">No active employees yet</p>
              <p className="text-xs mt-1">Click "Add Employee" to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Inactive Employees (collapsed) */}
      {inactiveEmployees.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Inactive / Deactivated ({inactiveEmployees.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {inactiveEmployees.map((emp) => (
              <div
                key={emp.employee_id}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500"
              >
                <UserX className="w-3 h-3" />
                <span>{emp.name}</span>
                <span className="font-mono text-slate-400">({emp.employee_id})</span>
                <button
                  onClick={() => onSaveEmployee({ ...emp, is_active: true })}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold"
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
                <span>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</span>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Employee ID *
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={form.employee_id}
                      onChange={(e) => setForm({ ...form, employee_id: e.target.value.toUpperCase() })}
                      placeholder="EMP004"
                      disabled={!!editingEmployee}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="rahul@traket.in"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                  Phone
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
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <UserX className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900">Deactivate Employee?</div>
                <div className="text-xs text-slate-500">Their lead assignments will remain.</div>
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
