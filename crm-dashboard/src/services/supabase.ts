import { createClient } from '@supabase/supabase-js';
import {
  FreightBooking,
  SessionRecord,
  SupportTicket,
  ClientCompanyProfile,
  Employee,
  LeadAssignment,
  SessionAssignment,
  SessionReminderLog,
  TraketVehicleType,
} from '../types';
import { resolvePinCode, estimateDistanceKm } from '../utils/pinResolver';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://njmzdeddmangggeukjce.supabase.co';
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qbXpkZWRkbWFuZ2dnZXVramNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTE0ODIsImV4cCI6MjEwMTQyNzQ4Mn0.uXZ8traER2l4mO86fRsBia9IVe-UX86tTygHg_NXUCw';

export const ACTIVE_CLIENT_PROFILE: ClientCompanyProfile = {
  name: 'Traket Logistics',
  phoneNumber: '+91 99309 95959',
  phoneNumberId: import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || '1240163099173755',
  whatsappStatus: 'connected',
  supabaseUrl: SUPABASE_URL,
};

/**
 * Categorizes a raw vehicle/container string into standard Traket vehicle categories:
 * - Truck (16ft, 19ft, 22ft, 24ft, 32ft, 10–40 MT Open/Full Body)
 * - Tempo (Tata Ace, Bolero, Pickup, 7ft to 17ft LCVs)
 * - Container (Domestic) (20ft, 24ft, 32ft SXL/MXL Close Body)
 * - Trailer / ODC (Flatbed, Lowbed, AMW 40 MT, Hydraulic, ODC)
 * - FCL 40 HC / HCL (40 High Cube Shipping Containers)
 * - FCL 20 (20 GP) (20ft General Purpose Shipping Containers)
 * - FCL 40 (40 GP) (40ft General Purpose Shipping Containers)
 * - Special Containers (Tank / Flexi / FR) (ISO Tank, Flexi, Flat Rack, Reefer)
 */
export function categorizeVehicle(vehicleStr?: string, cargoType?: string): TraketVehicleType | 'General' {
  if (!vehicleStr) return 'General';
  const v = vehicleStr.toLowerCase();
  const c = (cargoType || '').toLowerCase();

  // 1. Explicit prefixes / words (most reliable from DB: 'Tempo – ...', 'Truck – ...', 'Container – ...')
  if (v.startsWith('tempo') || /\btempo\b/.test(v)) {
    return 'Tempo';
  }

  // 2. EXIM Special Containers (Tank, Flexi, Flat Rack, Reefer)
  if (
    v.includes('tank') ||
    v.includes('flexi') ||
    v.includes(' fr') ||
    v.includes('(40 fr)') ||
    v.includes('reefer') ||
    v.includes('flat rack')
  ) {
    return 'Special Containers (Tank / Flexi / FR)';
  }

  // 3. FCL 40 HC / HCL (High Cube Containers)
  if (
    v.includes('40 hc') ||
    v.includes('40hc') ||
    v.includes('hcl') ||
    v.includes('high cube') ||
    (v.includes('40') && v.includes('hc'))
  ) {
    return 'FCL 40 HC / HCL';
  }

  // 4. FCL 20 GP
  if (v.includes('20 gp') || v.includes('20gp') || (v.includes('fcl 20') && !v.includes('40'))) {
    return 'FCL 20 (20 GP)';
  }

  // 5. FCL 40 GP
  if (v.includes('40 gp') || v.includes('40gp') || (v.includes('fcl 40') && !v.includes('hc') && !v.includes('fr'))) {
    return 'FCL 40 (40 GP)';
  }

  // Generic FCL if any remaining
  if (v.includes('fcl') || c.includes('import') || c.includes('export')) {
    if (v.includes('40')) return 'FCL 40 HC / HCL';
    if (v.includes('20')) return 'FCL 20 (20 GP)';
  }

  // 6. Trailer / ODC
  if (
    v.startsWith('trailer') ||
    v.includes('trailer') ||
    v.includes('odc') ||
    v.includes('flatbed') ||
    v.includes('lowbed') ||
    v.includes('hydraulic') ||
    v.includes('amw')
  ) {
    return 'Trailer / ODC';
  }

  // 7. Domestic Container
  if (
    v.startsWith('container') ||
    v.includes('close body') ||
    v.includes('mxl') ||
    v.includes('sxl') ||
    v.includes('container')
  ) {
    return 'Container (Domestic)';
  }

  // 8. Truck
  if (
    v.startsWith('truck') ||
    /\btruck\b/.test(v) ||
    v.includes('open') ||
    v.includes('full body') ||
    v.includes('pona dala') ||
    v.includes('half /') ||
    v.includes('12 mt') ||
    v.includes('30 mt') ||
    v.includes('35 mt') ||
    v.includes('40 mt') ||
    v.includes('24 ft')
  ) {
    return 'Truck';
  }

  // 9. Other Tempo keywords
  if (
    v.includes('pickup') ||
    v.includes('ace') ||
    v.includes('bolero') ||
    v.includes('7 ft') ||
    v.includes('8 ft') ||
    v.includes('9 ft') ||
    v.includes('14 ft') ||
    v.includes('17 ft')
  ) {
    return 'Tempo';
  }

  return 'General';
}

class SupabaseDataService {
  private client: any;
  public isOfflineMode: boolean = false;
  public lastSyncTime: string = new Date().toISOString();

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  // --- LOCAL OFFLINE CACHE HELPERS ---
  private setCache(key: string, data: any) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(`${key}_timestamp`, new Date().toISOString());
    } catch {
      // quota or private browsing
    }
  }

  private getCache<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  // Cache helper for lead status so UI is immediately responsive
  private getLocalStatuses(): Record<string, { status: FreightBooking['status']; remarks?: string }> {
    try {
      const stored = localStorage.getItem('traket_lead_statuses');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private setLocalStatus(userId: string, status: FreightBooking['status'], remarks?: string) {
    try {
      const current = this.getLocalStatuses();
      current[userId] = {
        status,
        ...(remarks !== undefined ? { remarks } : current[userId]?.remarks ? { remarks: current[userId].remarks } : {}),
      };
      localStorage.setItem('traket_lead_statuses', JSON.stringify(current));
    } catch {
      // ignore
    }
  }

  // --- FREIGHT BOOKINGS (book_vehicle untouched + separate lead_status table) ---
  async getBookings(): Promise<FreightBooking[]> {
    try {
      // Fetch bookings and separate lead_status table in parallel
      const [bookingsRes, statusRes] = await Promise.all([
        this.client
          .from('book_vehicle')
          .select('*')
          .order('updated_at', { ascending: false }),
        this.client
          .from('lead_status')
          .select('*'),
      ]);

      if (bookingsRes.error || !bookingsRes.data) {
        console.warn('⚠️ Supabase getBookings unreachable or paused. Falling back to local offline backup cache.');
        this.isOfflineMode = true;
        const cached = this.getCache<FreightBooking[]>('traket_cached_bookings');
        if (cached && cached.length > 0) return cached;
        return [];
      }

      this.isOfflineMode = false;
      this.lastSyncTime = new Date().toISOString();

      // Map statuses from lead_status table
      const statusMap = new Map<string, { status: FreightBooking['status']; remarks?: string }>();
      if (statusRes.data && Array.isArray(statusRes.data)) {
        for (const s of statusRes.data) {
          if (s.user_id) {
            statusMap.set(s.user_id, {
              status: s.status as FreightBooking['status'],
              remarks: s.remarks,
            });
          }
        }
      }

      const localMap = this.getLocalStatuses();

      // Only include completed orders in Freight Orders Desk
      // Incomplete/half-chats are tracked in users_master -> Live Bot Sessions
      const validCompletedOrders = bookingsRes.data.filter((d: any) => {
        const hasRoute = Boolean(d.origin && d.destination);
        const isCompleted = d.state === 'cta_menu' || d.state === 'main_menu';
        return hasRoute && isCompleted;
      });

      const processed = validCompletedOrders.map((d: any) => {
        const dbStatus = statusMap.get(d.user_id);
        const localStatus = localMap[d.user_id];
        const statusEntry = dbStatus || localStatus;
        return this.enhanceBooking(d, statusEntry);
      });

      // Save offline snapshot to local cache
      this.setCache('traket_cached_bookings', processed);
      return processed;
    } catch (err) {
      console.warn('Network error reaching Supabase, using offline backup cache:', err);
      this.isOfflineMode = true;
      const cached = this.getCache<FreightBooking[]>('traket_cached_bookings');
      return cached || [];
    }
  }

  private enhanceBooking(
    b: any,
    statusEntry?: { status: FreightBooking['status']; remarks?: string }
  ): FreightBooking {
    const flow = b.flow_data || {};
    const origin = b.origin || b.loadingPin || flow.loading_pin || flow.loading_yard || flow.stuffing_address || '';
    const destination = b.destination || b.unloadingPin || flow.unloading_pin || flow.unloading_address || flow.port_cfs || '';

    const originInfo = resolvePinCode(origin);
    const destInfo = resolvePinCode(destination);
    const distance = estimateDistanceKm(origin, destination);

    const originCity =
      flow.loading_location ||
      flow.loadingLocation ||
      flow.loading_district ||
      originInfo.city;

    const destinationCity =
      flow.unloading_location ||
      flow.unloadingLocation ||
      flow.unloading_district ||
      destInfo.city;

    const vehicleOrContainer =
      b.vehicle_or_container ||
      b.vehicleType ||
      flow.vehicle_type ||
      flow.fcl_type ||
      '';

    const cargoType = b.cargo_type || b.cargoType || flow.cargo_type || 'Domestic';
    const materialOrLine = b.material_or_line || b.material || flow.material || flow.shipping_line || '';
    const weight = b.weight || flow.weight || flow.vehicle_sub_type || '';
    const loadingDate = b.loading_date || b.loadingDate || flow.loading_date || '';
    const timeSlot = b.time_slot || flow.time_slot || '';
    const company = b.company_name || b.company || flow.company_name || '';
    const contactName = b.contact_name || b.contactName || flow.contact_name || '';
    const phone = b.phone || flow.phone || '';
    const alternatePhone = b.alternate_phone || flow.alternate_phone || '';
    const remarks =
      statusEntry && statusEntry.remarks !== undefined && statusEntry.remarks !== ''
        ? statusEntry.remarks
        : b.remarks || flow.remarks || '';
    const status = statusEntry?.status || 'new';

    return {
      user_id: b.user_id,
      phone,
      alternate_phone: alternatePhone,
      state: b.state || 'cta_menu',
      cargo_type: cargoType,
      origin,
      destination,
      vehicle_or_container: vehicleOrContainer,
      material_or_line: materialOrLine,
      weight,
      loading_date: loadingDate,
      time_slot: timeSlot,
      company_name: company,
      contact_name: contactName,
      email: b.email || flow.email || '',
      remarks,
      status,
      updated_at: b.updated_at || new Date().toISOString(),
      flow_data: flow,

      // Geocoded details
      originCity: originCity,
      destinationCity: destinationCity,
      estimatedDistanceKm: distance,
    };
  }

  // Save status and lead information to separate lead_status table (book_vehicle is completely untouched)
  async updateBookingStatus(
    userId: string,
    newStatus: FreightBooking['status'],
    remarks?: string,
    phone?: string,
    name?: string
  ): Promise<boolean> {
    try {
      this.setLocalStatus(userId, newStatus, remarks);

      const payload: Record<string, any> = {
        user_id: userId,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (phone !== undefined) payload.phone = phone;
      if (name !== undefined) payload.name = name;
      if (remarks !== undefined) payload.remarks = remarks;

      const { error } = await this.client
        .from('lead_status')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.warn('Could not save to lead_status table (will use local cache until table is created in Supabase):', error.message);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Failed to update booking status:', e);
      return false;
    }
  }

  // --- LIVE CONVERSATION SESSIONS (users_master) ---
  async getSessions(): Promise<SessionRecord[]> {
    try {
      const { data, error } = await this.client
        .from('users_master')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error || !data) {
        return [];
      }

      return data.map((d: any) => ({
        user_id: d.user_id,
        phone: d.phone,
        state: d.state,
        updated_at: d.updated_at,
        flow_type: d.flow_type || '',
        data: typeof d.data === 'string' ? JSON.parse(d.data || '{}') : d.data || {},
      }));
    } catch (err) {
      console.error('Error fetching sessions:', err);
      return [];
    }
  }

  // --- SUPPORT TICKETS (support) ---
  async getSupportTickets(): Promise<SupportTicket[]> {
    try {
      const { data, error } = await this.client
        .from('support')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((d: any) => ({
        user_id: d.user_id,
        phone: d.phone || '',
        contact_name: d.contact_name || '',
        subject: d.subject || 'WhatsApp Support Inquiry',
        message: d.message || 'Customer requested assistance from WhatsApp bot',
        status: (d.status as SupportTicket['status']) || 'open',
        priority: (d.priority as SupportTicket['priority']) || 'medium',
        updated_at: d.updated_at || new Date().toISOString(),
      }));
    } catch (err) {
      console.error('Error fetching support tickets:', err);
      return [];
    }
  }

  async updateSupportStatus(
    userId: string,
    status: SupportTicket['status']
  ): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('support')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      return !error;
    } catch (e) {
      console.error('Failed to update support status:', e);
      return false;
    }
  }

  // --- EMPLOYEES ---
  async getEmployees(): Promise<Employee[]> {
    try {
      const { data, error } = await this.client
        .from('employees')
        .select('*')
        .order('created_at', { ascending: true });
      if (error || !data) return this.getLocalEmployees();

      // Merge with local storage for custom fields like assigned_vehicles
      const localEmps = this.getLocalEmployees();
      const localMap = new Map(localEmps.map((e) => [e.employee_id, e]));
      const merged: Employee[] = (data as any[]).map((d) => {
        const local = localMap.get(d.employee_id);
        return {
          ...d,
          assigned_vehicles: d.assigned_vehicles || local?.assigned_vehicles || [],
        };
      });

      localStorage.setItem('traket_employees', JSON.stringify(merged));
      return merged;
    } catch {
      return this.getLocalEmployees();
    }
  }

  getLocalEmployees(): Employee[] {
    try {
      const stored = localStorage.getItem('traket_employees');
      if (stored) {
        const parsed = JSON.parse(stored) as Employee[];
        // Filter out old dummy seed entries if present
        const dummyEmails = ['preet@traket.in', 'vatsal@traket.in', 'anil@traket.in'];
        const dummyNames = ['preet karani', 'vatsal shah', 'anil kumar'];
        const cleaned = parsed.filter(
          (e) =>
            !dummyEmails.includes(e.email?.toLowerCase().trim() || '') &&
            !dummyNames.includes(e.name?.toLowerCase().trim() || '')
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('traket_employees', JSON.stringify(cleaned));
        }
        return cleaned;
      }
    } catch {}
    return [];
  }

  async upsertEmployee(emp: Omit<Employee, 'id' | 'created_at'>): Promise<Employee | null> {
    const all = this.getLocalEmployees();
    const exists = all.findIndex((e) => e.employee_id === emp.employee_id);
    const newEmp: Employee = {
      ...emp,
      id: emp.employee_id,
      created_at: new Date().toISOString(),
      assigned_vehicles: emp.assigned_vehicles || [],
    };
    if (exists >= 0) all[exists] = newEmp;
    else all.push(newEmp);
    localStorage.setItem('traket_employees', JSON.stringify(all));

    try {
      const payload: any = { ...emp, updated_at: new Date().toISOString() };
      let { data, error } = await this.client
        .from('employees')
        .upsert(payload, { onConflict: 'employee_id' })
        .select()
        .single();

      if (error && error.message?.includes('assigned_vehicles')) {
        const { assigned_vehicles, ...rest } = payload;
        const retryRes = await this.client
          .from('employees')
          .upsert(rest, { onConflict: 'employee_id' })
          .select()
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (data) {
        return { ...data, assigned_vehicles: emp.assigned_vehicles || [] } as Employee;
      }
    } catch (e) {
      console.warn('Supabase upsertEmployee fallback to local storage:', e);
    }
    return newEmp;
  }

  // --- VEHICLE AUTO LEAD ASSIGNMENT ---
  isAutoLeadAssignmentEnabled(): boolean {
    try {
      const val = localStorage.getItem('traket_auto_lead_assignment');
      return val === null ? true : val === 'true'; // Default is Active
    } catch {
      return true;
    }
  }

  setAutoLeadAssignmentEnabled(enabled: boolean): void {
    try {
      localStorage.setItem('traket_auto_lead_assignment', enabled ? 'true' : 'false');
    } catch {}
  }

  async autoAssignBookingsByVehicle(
    bookings: FreightBooking[],
    employees: Employee[],
    currentAssignments: Record<string, LeadAssignment>
  ): Promise<{ assignedCount: number; updatedAssignments: Record<string, LeadAssignment> }> {
    if (!this.isAutoLeadAssignmentEnabled()) {
      return { assignedCount: 0, updatedAssignments: currentAssignments };
    }

    const activeEmps = employees.filter((e) => e.is_active);
    const updated = { ...currentAssignments };
    let assignedCount = 0;
    let modified = false;

    // Build map of employee ID -> Employee object
    const empMap = new Map<string, Employee>();
    employees.forEach((e) => empMap.set(e.employee_id, e));

    // Track active lead counts per employee to balance assignment load
    const loadMap = new Map<string, number>();
    activeEmps.forEach((e) => {
      loadMap.set(e.employee_id, 0);
    });

    // 1. AUDIT & CLEAN UP MISMATCHED ASSIGNMENTS:
    // If a lead was auto-assigned (not manually transferred) to an employee who does NOT handle
    // that specific vehicle category, clear that assignment so non-truck leads are removed from truck-only employees.
    for (const b of bookings) {
      const existing = updated[b.user_id];
      if (existing?.assigned_to) {
        // If it was manually transferred by admin, respect manual override
        if (existing.transferred_from || existing.transfer_note?.startsWith('Transferred')) {
          const count = loadMap.get(existing.assigned_to) || 0;
          loadMap.set(existing.assigned_to, count + 1);
          continue;
        }

        const assignedEmp = empMap.get(existing.assigned_to);
        const vehicleCat = categorizeVehicle(b.vehicle_or_container, b.cargo_type);

        // Check if assigned employee is active and specialized in this vehicle category
        const isSpecialist =
          assignedEmp &&
          assignedEmp.is_active &&
          Array.isArray(assignedEmp.assigned_vehicles) &&
          assignedEmp.assigned_vehicles.includes(vehicleCat as any);

        if (!isSpecialist) {
          // Employee doesn't handle this vehicle! Clear the mismatched assignment
          delete updated[b.user_id];
          modified = true;
          this.unassignLead(b.user_id).catch(() => {});
        } else {
          const count = loadMap.get(existing.assigned_to) || 0;
          loadMap.set(existing.assigned_to, count + 1);
        }
      }
    }

    if (activeEmps.length === 0) {
      if (modified) {
        localStorage.setItem('traket_assignments', JSON.stringify(updated));
      }
      return { assignedCount: 0, updatedAssignments: updated };
    }

    // 2. STRICT VEHICLE ASSIGNMENT:
    // If a lead is for a vehicle, ONLY assign to employees configured for that specific vehicle.
    // If no matching employee exists, KEEP IT UNASSIGNED (never fallback to truck employee).
    for (const b of bookings) {
      // Skip if already assigned
      if (updated[b.user_id]?.assigned_to) continue;

      const vehicleCat = categorizeVehicle(b.vehicle_or_container, b.cargo_type);

      // STRICT: Only employees who have explicitly selected this vehicle category
      const matchingEmps = activeEmps.filter((e) =>
        Array.isArray(e.assigned_vehicles) && e.assigned_vehicles.includes(vehicleCat as any)
      );

      // STRICT: If no active employee specializes in this vehicle, LEAVE IT UNASSIGNED!
      if (matchingEmps.length === 0) {
        continue;
      }

      // Pick employee with lowest current workload among valid vehicle specialists
      matchingEmps.sort((a, b) => (loadMap.get(a.employee_id) || 0) - (loadMap.get(b.employee_id) || 0));
      const chosenEmp = matchingEmps[0];

      if (chosenEmp) {
        await this.assignLead(b.user_id, chosenEmp.employee_id);
        updated[b.user_id] = {
          user_id: b.user_id,
          assigned_to: chosenEmp.employee_id,
          assigned_at: new Date().toISOString(),
          transfer_note: `Auto-Assigned by Vehicle (${vehicleCat})`,
        };
        loadMap.set(chosenEmp.employee_id, (loadMap.get(chosenEmp.employee_id) || 0) + 1);
        assignedCount++;
        modified = true;
      }
    }

    if (modified) {
      localStorage.setItem('traket_assignments', JSON.stringify(updated));
    }

    return { assignedCount, updatedAssignments: updated };
  }

  async deactivateEmployee(employeeId: string): Promise<boolean> {
    try {
      await this.client.from('employees').update({ is_active: false }).eq('employee_id', employeeId);
    } catch {}
    const all = this.getLocalEmployees().map((e) =>
      e.employee_id === employeeId ? { ...e, is_active: false } : e
    );
    localStorage.setItem('traket_employees', JSON.stringify(all));
    return true;
  }

  // --- LEAD ASSIGNMENTS ---
  getLocalAssignments(): Record<string, LeadAssignment> {
    try {
      const stored = localStorage.getItem('traket_assignments');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  }

  private setLocalAssignment(userId: string, a: LeadAssignment) {
    const all = this.getLocalAssignments();
    all[userId] = a;
    localStorage.setItem('traket_assignments', JSON.stringify(all));
  }

  async assignLead(userId: string, employeeId: string): Promise<boolean> {
    const assignment: LeadAssignment = {
      user_id: userId,
      assigned_to: employeeId,
      assigned_at: new Date().toISOString(),
    };
    this.setLocalAssignment(userId, assignment);
    try {
      await this.client.from('lead_status').upsert(
        { user_id: userId, assigned_to: employeeId, assigned_at: assignment.assigned_at },
        { onConflict: 'user_id' }
      );
    } catch {}
    return true;
  }

  async unassignLead(userId: string): Promise<boolean> {
    const all = this.getLocalAssignments();
    delete all[userId];
    localStorage.setItem('traket_assignments', JSON.stringify(all));
    try {
      await this.client.from('lead_status').upsert(
        { user_id: userId, assigned_to: null, assigned_at: null },
        { onConflict: 'user_id' }
      );
    } catch {}
    return true;
  }

  async transferLead(userId: string, newEmployeeId: string, transferNote?: string): Promise<boolean> {
    const existing = this.getLocalAssignments()[userId];
    const assignment: LeadAssignment = {
      user_id: userId,
      assigned_to: newEmployeeId,
      assigned_at: new Date().toISOString(),
      transferred_from: existing?.assigned_to,
      transfer_note: transferNote,
    };
    this.setLocalAssignment(userId, assignment);
    try {
      await this.client.from('lead_status').upsert(
        {
          user_id: userId,
          assigned_to: newEmployeeId,
          assigned_at: assignment.assigned_at,
          transferred_from: assignment.transferred_from,
          transfer_note: transferNote,
        },
        { onConflict: 'user_id' }
      );
    } catch {}
    return true;
  }

  // --- SESSION AUTO-ASSIGNMENT & REMINDERS ---
  getLocalSessionAssignments(): Record<string, SessionAssignment> {
    try {
      const stored = localStorage.getItem('traket_session_assignments');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  setSessionAssignment(userId: string, employeeId: string, employeeName: string): SessionAssignment {
    const all = this.getLocalSessionAssignments();
    const assignment: SessionAssignment = {
      user_id: userId,
      assigned_to: employeeId,
      assigned_name: employeeName,
      assigned_at: new Date().toISOString(),
    };
    all[userId] = assignment;
    localStorage.setItem('traket_session_assignments', JSON.stringify(all));
    return assignment;
  }

  autoAssignSessions(
    sessions: SessionRecord[],
    employees: Employee[]
  ): { assignments: Record<string, SessionAssignment>; newlyAssignedCount: number } {
    const activeEmps = employees.filter((e) => e.is_active);
    const all = this.getLocalSessionAssignments();
    let newlyAssignedCount = 0;

    if (activeEmps.length === 0) {
      return { assignments: all, newlyAssignedCount: 0 };
    }

    let index = Object.keys(all).length % activeEmps.length;

    for (const s of sessions) {
      if (!all[s.user_id]) {
        const emp = activeEmps[index % activeEmps.length];
        all[s.user_id] = {
          user_id: s.user_id,
          assigned_to: emp.employee_id,
          assigned_name: emp.name,
          assigned_at: new Date().toISOString(),
        };
        index++;
        newlyAssignedCount++;
      }
    }

    localStorage.setItem('traket_session_assignments', JSON.stringify(all));
    return { assignments: all, newlyAssignedCount };
  }

  getLocalReminderLogs(): Record<string, SessionReminderLog> {
    try {
      const stored = localStorage.getItem('traket_session_reminder_logs');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  saveReminderLog(userId: string, stage: 1 | 2 | 3, messageId?: string): SessionReminderLog {
    const all = this.getLocalReminderLogs();
    const existing = all[userId] || { user_id: userId };
    const now = new Date().toISOString();

    if (stage === 1) existing.r1_sent_at = now;
    if (stage === 2) existing.r2_sent_at = now;
    if (stage === 3) existing.r3_sent_at = now;
    existing.last_stage = stage;
    if (messageId) existing.last_message_id = messageId;

    all[userId] = existing;
    localStorage.setItem('traket_session_reminder_logs', JSON.stringify(all));
    return existing;
  }
}

export const dbService = new SupabaseDataService();

