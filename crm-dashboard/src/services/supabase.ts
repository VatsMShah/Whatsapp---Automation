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

  // --- FREIGHT BOOKINGS (Unified book_vehicle table) ---
  async getBookings(): Promise<FreightBooking[]> {
    try {
      const { data, error } = await this.client
        .from('book_vehicle')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error || !data) {
        console.warn('Supabase getBookings returned error or empty:', error);
        return [];
      }

      return data.map((d: any) => this.enhanceBooking(d));
    } catch (err) {
      console.error('Error fetching bookings from Supabase:', err);
      return [];
    }
  }

  private enhanceBooking(b: any): FreightBooking {
    const flow = b.flow_data || {};
    const origin = b.origin || b.loadingPin || flow.loading_pin || flow.loading_yard || flow.stuffing_address || '';
    const destination = b.destination || b.unloadingPin || flow.unloading_pin || flow.unloading_address || flow.port_cfs || '';

    const originInfo = resolvePinCode(origin);
    const destInfo = resolvePinCode(destination);
    const distance = estimateDistanceKm(origin, destination);

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
    const remarks = b.remarks || flow.remarks || '';
    const status = (b.status as FreightBooking['status']) || 'new';

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
      originCity: originInfo.city,
      destinationCity: destInfo.city,
      estimatedDistanceKm: distance,
    };
  }

  async updateBookingStatus(
    userId: string,
    newStatus: FreightBooking['status'],
    remarks?: string
  ): Promise<boolean> {
    try {
      const payload: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (remarks !== undefined) {
        payload.remarks = remarks;
      }

      const { error } = await this.client
        .from('book_vehicle')
        .update(payload)
        .eq('user_id', userId);

      return !error;
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
