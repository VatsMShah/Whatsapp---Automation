import { createClient } from '@supabase/supabase-js';
import {
  FreightBooking,
  SessionRecord,
  SupportTicket,
  ClientCompanyProfile,
  Employee,
  LeadAssignment,
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
      // Persist to local cache
      localStorage.setItem('traket_employees', JSON.stringify(data));
      return data as Employee[];
    } catch {
      return this.getLocalEmployees();
    }
  }

  getLocalEmployees(): Employee[] {
    try {
      const stored = localStorage.getItem('traket_employees');
      if (stored) return JSON.parse(stored) as Employee[];
    } catch {}
    // Seed with defaults if nothing stored
    const defaults: Employee[] = [
      { id: '1', employee_id: 'EMP001', name: 'Preet Karani', email: 'preet@traket.in', phone: '', department: 'Sales', is_active: true, created_at: new Date().toISOString() },
      { id: '2', employee_id: 'EMP002', name: 'Vatsal Shah', email: 'vatsal@traket.in', phone: '', department: 'Ops', is_active: true, created_at: new Date().toISOString() },
      { id: '3', employee_id: 'EMP003', name: 'Anil Kumar', email: 'anil@traket.in', phone: '', department: 'Sales', is_active: true, created_at: new Date().toISOString() },
    ];
    localStorage.setItem('traket_employees', JSON.stringify(defaults));
    return defaults;
  }

  async upsertEmployee(emp: Omit<Employee, 'id' | 'created_at'>): Promise<Employee | null> {
    try {
      const payload = { ...emp, updated_at: new Date().toISOString() };
      const { data, error } = await this.client
        .from('employees')
        .upsert(payload, { onConflict: 'employee_id' })
        .select()
        .single();
      if (error || !data) throw error;
      // Refresh local cache
      await this.getEmployees();
      return data as Employee;
    } catch {
      // Fall back to local storage only
      const all = this.getLocalEmployees();
      const exists = all.findIndex((e) => e.employee_id === emp.employee_id);
      const newEmp: Employee = { ...emp, id: emp.employee_id, created_at: new Date().toISOString() };
      if (exists >= 0) all[exists] = newEmp; else all.push(newEmp);
      localStorage.setItem('traket_employees', JSON.stringify(all));
      return newEmp;
    }
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
}

export const dbService = new SupabaseDataService();

