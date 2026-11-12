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
import { authService } from './auth';

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
 * Categorizes a raw vehicle/container string into standard Traket vehicle categories directly from WhatsApp:
 * - Tempo (Small loads 1 - 10 MT)
 * - Truck (Open / Closed 12 - 40 MT)
 * - Container (Domestic) (32 Ft SXL / MXL Close Body)
 * - Trailer / ODC (3518, 4018, AMW)
 * - FCL 20 (20 GP, 20 FLEXI, 20 TANK)
 * - FCL 40 (40 HC, 40 Open Top, 40 FR)
 */
export function categorizeVehicle(vehicleStr?: string, cargoType?: string): TraketVehicleType | 'General' {
  if (!vehicleStr) return 'General';
  const v = vehicleStr.toLowerCase();
  const c = (cargoType || '').toLowerCase();

  // 1. Explicit Tempo
  if (
    v.startsWith('tempo') ||
    /\btempo\b/.test(v) ||
    v.includes('pickup') ||
    v.includes('ace') ||
    v.includes('bolero')
  ) {
    return 'Tempo';
  }

  // 2. FCL 20 (20 GP, 20 Flexi, 20 Tank, Tuskar)
  if (
    v.includes('fcl 20') ||
    v.includes('20 gp') ||
    v.includes('20gp') ||
    v.includes('20 flexi') ||
    v.includes('flexi') ||
    v.includes('20 tank') ||
    v.includes('tank') ||
    v.includes('tuskar')
  ) {
    return 'FCL 20';
  }

  // 3. FCL 40 (40 HC, 40 Open Top, 40 FR)
  if (
    v.includes('fcl 40') ||
    v.includes('40 hc') ||
    v.includes('40hc') ||
    v.includes('40 open') ||
    v.includes('open top') ||
    v.includes('40 fr') ||
    v.includes('flat rack') ||
    ((c.includes('import') || c.includes('export')) &&
      (v.includes('3518 (24') || v.includes('4018 (29') || v.includes('amw (30')))
  ) {
    return 'FCL 40';
  }

  // Generic FCL / Import / Export fallback
  if (v.includes('fcl') || c.includes('import') || c.includes('export')) {
    if (v.includes('20')) return 'FCL 20';
    return 'FCL 40';
  }

  // 4. Trailer / ODC
  if (
    v.startsWith('trailer') ||
    v.includes('trailer') ||
    v.includes('odc') ||
    v.includes('over dimension') ||
    v.includes('highbed') ||
    v.includes('semi bed') ||
    v.includes('low bed') ||
    v.includes('3518 (27') ||
    v.includes('4018 (33') ||
    v.includes('amw (40')
  ) {
    return 'Trailer / ODC';
  }

  // 5. Domestic Container (32 Ft SXL, MXL)
  if (
    v.startsWith('container') ||
    v.includes('close body') ||
    v.includes('mxl') ||
    v.includes('sxl') ||
    v.includes('32 ft container')
  ) {
    return 'Container (Domestic)';
  }

  // 6. Truck (12 - 40 MT, Open / Closed)
  if (
    v.startsWith('truck') ||
    /\btruck\b/.test(v) ||
    v.includes('taurus') ||
    v.includes('full body') ||
    v.includes('pona dala') ||
    v.includes('open body') ||
    v.includes('close body') ||
    v.includes('12 mt') ||
    v.includes('18 mt') ||
    v.includes('25 mt') ||
    v.includes('30 mt') ||
    v.includes('35 mt') ||
    v.includes('40 mt')
  ) {
    return 'Truck';
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

      // Track completed user_ids to deduplicate between book_vehicle and users_master
      const completedUserIds = new Set<string>();

      // Only include completed orders in Freight Orders Desk
      // Incomplete/half-chats are tracked in users_master -> Live Bot Sessions
      const validCompletedOrders = (bookingsRes.data || []).filter((d: any) => {
        const hasRoute = Boolean(d.origin && d.destination);
        const hasContact = Boolean(d.contact_name || d.company_name);
        const isCompletedState =
          d.state === 'cta_menu' ||
          d.state === 'main_menu' ||
          d.state === 'completed' ||
          d.state === 'cta_ai';
        const isCompleteLead = hasRoute && (isCompletedState || hasContact);
        if (isCompleteLead && d.user_id) {
          completedUserIds.add(d.user_id);
        }
        return isCompleteLead;
      });

      // Also pull recent completed booking sessions from users_master (state === 'cta_menu' and flow_type === 'book')
      // This ensures 100% real-time instant synchronization of finished WhatsApp orders into Freight Orders Desk
      try {
        const { data: completedSessions } = await this.client
          .from('users_master')
          .select('*')
          .eq('state', 'cta_menu')
          .eq('flow_type', 'book')
          .order('updated_at', { ascending: false })
          .limit(50);

        if (completedSessions && Array.isArray(completedSessions)) {
          for (const cs of completedSessions) {
            if (!completedUserIds.has(cs.user_id)) {
              const flowData = typeof cs.data === 'string' ? JSON.parse(cs.data || '{}') : cs.data || {};
              const origin = flowData.loadingYard || flowData.stuffingAddress || flowData.loadingLocation || flowData.loadingPin || '';
              const destination = flowData.unloadingAddress || flowData.portCfs || flowData.unloadingLocation || flowData.unloadingPin || '';
              if (origin && destination) {
                validCompletedOrders.push({
                  user_id: cs.user_id,
                  phone: cs.phone || flowData.phone || '',
                  state: 'cta_menu',
                  cargo_type: flowData.cargoType || 'Domestic',
                  origin: origin,
                  destination: destination,
                  vehicle_or_container: flowData.vehicleSubType || flowData.vehicleType || 'Standard',
                  material_or_line: flowData.shippingLine || flowData.material || '',
                  weight: flowData.weight || '',
                  loading_date: flowData.loadingDate || '',
                  time_slot: flowData.loadingTime || '',
                  company_name: flowData.company || '',
                  contact_name: flowData.contactName || '',
                  email: flowData.email || '',
                  remarks: flowData.remarks || '',
                  is_decision_maker: flowData.isDecisionMaker !== undefined ? flowData.isDecisionMaker : true,
                  approver_name: flowData.approverName || '',
                  approver_phone: flowData.approverPhone || '',
                  approver_role: flowData.approverRole || '',
                  alternate_phone: flowData.alternatePhone || '',
                  flow_data: flowData,
                  updated_at: cs.updated_at,
                });
                completedUserIds.add(cs.user_id);
              }
            }
          }
        }
      } catch (mergeErr) {
        console.warn('Could not check users_master for completed bookings:', mergeErr);
      }

      // Sort by updated_at descending
      validCompletedOrders.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

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

    const vehicleSubType =
      b.vehicle_sub_type ||
      flow.vehicle_sub_type ||
      flow.vehicleSubType ||
      '';

    const isDecisionMaker = b.is_decision_maker !== undefined
      ? b.is_decision_maker
      : (flow.is_decision_maker !== undefined ? flow.is_decision_maker : (!b.approver_name && !flow.approver_name));

    const approverName = b.approver_name || flow.approver_name || flow.approverName || (isDecisionMaker ? contactName : '');
    const approverPhone = b.approver_phone || flow.approver_phone || flow.approverPhone || alternatePhone || (isDecisionMaker ? phone : '');
    const approverRole = b.approver_role || flow.approver_role || flow.approverRole || (isDecisionMaker ? 'Decision Maker (Self)' : 'Commercial Approver');
    const submitterName = b.submitter_name || flow.submitter_name || flow.submitterName || contactName;
    const submitterPhone = b.submitter_phone || flow.submitter_phone || flow.submitterPhone || phone;

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
      vehicle_sub_type: vehicleSubType,

      // Decision-Maker vs Submitter separation
      is_decision_maker: isDecisionMaker,
      approver_name: approverName,
      approver_phone: approverPhone,
      approver_role: approverRole,
      submitter_name: submitterName,
      submitter_phone: submitterPhone,

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
        .limit(150);

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

  // Clear cached CRM/auth storage on logout so sensitive data never persists across sessions
  clearLocalCaches(): void {
    authService.clearStoredAuth();
    try {
      const keysToRemove = [
        'traket_employees',
        'traket_cached_bookings',
        'traket_cached_bookings_timestamp',
        'traket_lead_statuses',
        'traket_assignments',
        'traket_session_assignments',
        'traket_session_reminder_logs',
      ];
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      }
    } catch {}
  }

  // --- EMPLOYEES ---
  async getEmployees(): Promise<Employee[]> {
    if (!authService.getStoredToken()) {
      return [];
    }
    try {
      localStorage.removeItem('traket_employees');
    } catch {}

    const res = await authService.getEmployees();
    if (!res.success) {
      return [];
    }
    return res.employees;
  }

  getLocalEmployees(): Employee[] {
    return [];
  }

  async upsertEmployee(emp: Omit<Employee, 'id' | 'created_at'>): Promise<Employee | null> {
    const res = await authService.upsertEmployee(emp);
    if (!res.success || !res.employee) {
      throw new Error(res.error || 'Failed to save employee.');
    }
    return res.employee;
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

    // 1. Audit existing assignments: Count active loads and respect all manual assignments
    for (const b of bookings) {
      const existing = updated[b.user_id];
      if (existing?.assigned_to) {
        const count = loadMap.get(existing.assigned_to) || 0;
        loadMap.set(existing.assigned_to, count + 1);
      }
    }

    if (activeEmps.length === 0) {
      if (modified) {
        localStorage.setItem('traket_assignments', JSON.stringify(updated));
      }
      return { assignedCount: 0, updatedAssignments: updated };
    }

    // 2. STRICT VEHICLE & SUBTYPE ASSIGNMENT:
    // If a lead is for a vehicle, ONLY assign to employees configured for that specific vehicle.
    // If specialists configured for that specific subtype/weight exist, prioritize them!
    // If no matching employee exists, KEEP IT UNASSIGNED.
    for (const b of bookings) {
      // Skip if already assigned or explicitly manually unassigned by Admin
      const existing = updated[b.user_id];
      if (existing?.assigned_to || existing?.transfer_note === 'Manual Unassign') continue;

      const vehicleCat = categorizeVehicle(b.vehicle_or_container, b.cargo_type);

      // STRICT: Only employees who have explicitly selected this vehicle category
      let matchingEmps = activeEmps.filter((e) =>
        Array.isArray(e.assigned_vehicles) && e.assigned_vehicles.includes(vehicleCat as any)
      );

      // STRICT: If no active employee specializes in this vehicle, LEAVE IT UNASSIGNED!
      if (matchingEmps.length === 0) {
        continue;
      }

      // Check for Subtype-level specialization:
      // If the lead specifies a subtype or weight (e.g. '1 MT', '10 MT', '20 MT', '32 Ft MXL', etc.)
      const rawLeadSub = (b.vehicle_sub_type || b.weight || b.vehicle_or_container || '').toLowerCase();
      const normLeadSub = rawLeadSub.replace(/[^a-z0-9]/g, '');

      if (rawLeadSub && normLeadSub) {
        // Find specialists whose assigned subtypes explicitly match the lead's subtype/capacity
        const matchingSpecialists = matchingEmps.filter((e) => {
          if (!e.assigned_subtypes || e.assigned_subtypes.length === 0) return false;
          return e.assigned_subtypes.some((s) => {
            const rawS = s.toLowerCase();
            const normS = rawS.replace(/[^a-z0-9]/g, '');
            return (
              rawLeadSub.includes(rawS) ||
              rawS.includes(rawLeadSub) ||
              normLeadSub.includes(normS) ||
              normS.includes(normLeadSub)
            );
          });
        });

        if (matchingSpecialists.length > 0) {
          // Exact subtype match found! Prioritize specialists
          matchingEmps = matchingSpecialists;
        } else {
          // Fall back to generalists (who haven't restricted their subtypes for this vehicle)
          const generalists = matchingEmps.filter(
            (e) => !e.assigned_subtypes || e.assigned_subtypes.length === 0
          );
          if (generalists.length > 0) {
            matchingEmps = generalists;
          }
        }
      }

      // Pick employee with lowest current workload among valid vehicle specialists
      matchingEmps.sort((a, b) => (loadMap.get(a.employee_id) || 0) - (loadMap.get(b.employee_id) || 0));
      const chosenEmp = matchingEmps[0];

      if (chosenEmp) {
        await this.assignLead(b.user_id, chosenEmp.employee_id);
        const subNote = b.vehicle_sub_type ? ` - ${b.vehicle_sub_type}` : '';
        updated[b.user_id] = {
          user_id: b.user_id,
          assigned_to: chosenEmp.employee_id,
          assigned_at: new Date().toISOString(),
          transfer_note: `Auto-Assigned by Vehicle (${vehicleCat}${subNote})`,
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
    const res = await authService.deactivateEmployee(employeeId);
    if (!res.success) {
      throw new Error(res.error || 'Failed to deactivate employee.');
    }
    return true;
  }

  // --- LEAD ASSIGNMENTS ---
  async getAssignments(): Promise<Record<string, LeadAssignment>> {
    const local = this.getLocalAssignments();
    try {
      const { data, error } = await this.client
        .from('lead_status')
        .select('user_id, assigned_to, assigned_at, transferred_from, transfer_note')
        .not('assigned_to', 'is', null);

      if (!error && Array.isArray(data)) {
        // Database is the authoritative source of truth for active assignments
        const fresh: Record<string, LeadAssignment> = {};
        for (const row of data as any[]) {
          if (row.user_id && row.assigned_to) {
            fresh[row.user_id] = {
              user_id: row.user_id,
              assigned_to: row.assigned_to,
              assigned_at: row.assigned_at || new Date().toISOString(),
              transferred_from: row.transferred_from,
              transfer_note: row.transfer_note,
            };
          }
        }
        localStorage.setItem('traket_assignments', JSON.stringify(fresh));
        return fresh;
      }
    } catch {}
    return local;
  }

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
    const { error } = await this.client.from('lead_status').upsert(
      { user_id: userId, assigned_to: employeeId, assigned_at: assignment.assigned_at },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('Supabase assignLead error:', error);
      throw new Error(error.message || 'Failed to assign lead in Supabase');
    }
    return true;
  }

  async unassignLead(userId: string): Promise<boolean> {
    const all = this.getLocalAssignments();
    delete all[userId];
    localStorage.setItem('traket_assignments', JSON.stringify(all));
    const { error } = await this.client.from('lead_status').upsert(
      { user_id: userId, assigned_to: null, assigned_at: null, transfer_note: 'Manual Unassign' },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('Supabase unassignLead error:', error);
      throw new Error(error.message || 'Failed to unassign lead in Supabase');
    }
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
    const { error } = await this.client.from('lead_status').upsert(
      {
        user_id: userId,
        assigned_to: newEmployeeId,
        assigned_at: assignment.assigned_at,
        transferred_from: assignment.transferred_from,
        transfer_note: transferNote,
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('Supabase transferLead error:', error);
      throw new Error(error.message || 'Failed to transfer lead in Supabase');
    }
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

