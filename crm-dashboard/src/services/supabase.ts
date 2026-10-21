import { createClient } from '@supabase/supabase-js';
import {
  FreightBooking,
  SessionRecord,
  SupportTicket,
  ClientCompanyProfile,
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

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
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
        console.warn('Supabase getBookings returned error or empty:', bookingsRes.error);
        return [];
      }

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

      return validCompletedOrders.map((d: any) => {
        const dbStatus = statusMap.get(d.user_id);
        const localStatus = localMap[d.user_id];
        const statusEntry = dbStatus || localStatus;
        return this.enhanceBooking(d, statusEntry);
      });
    } catch (err) {
      console.error('Error fetching bookings from Supabase:', err);
      return [];
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
}

export const dbService = new SupabaseDataService();
