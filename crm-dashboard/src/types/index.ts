export interface FreightBooking {
  user_id: string;
  phone: string;
  alternate_phone?: string;
  state: string;
  cargo_type: string;
  origin: string;
  destination: string;
  vehicle_or_container: string;
  material_or_line: string;
  weight: string;
  loading_date: string;
  time_slot: string;
  company_name: string;
  contact_name: string;
  email?: string;
  remarks?: string;
  status: 'new' | 'quoted' | 'confirmed' | 'in_transit' | 'completed' | 'cancelled';
  updated_at: string;
  flow_data?: Record<string, any>;
  
  // Enriched UI helpers
  originCity?: string;
  destinationCity?: string;
  estimatedDistanceKm?: number;
}

export interface SessionRecord {
  user_id: string;
  phone: string;
  state: string;
  updated_at: string;
  flow_type?: string;
  data: Record<string, any>;
}

export interface SupportTicket {
  user_id: string;
  phone?: string;
  contact_name?: string;
  subject?: string;
  message?: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority?: 'high' | 'medium' | 'low';
  updated_at: string;
}

export interface ClientCompanyProfile {
  name: string;
  phoneNumber: string;
  phoneNumberId: string;
  whatsappStatus: 'connected' | 'disconnected';
  supabaseUrl: string;
}

export type DashboardTab = 'orders' | 'overview' | 'inquiries' | 'team';

export interface Employee {
  id: string;           // UUID primary key
  employee_id: string;  // Human-readable e.g. EMP001
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  password?: string;
  role?: 'admin' | 'employee';
  is_active: boolean;
  created_at: string;
  assigned_vehicles?: string[]; // Vehicle specializations: Truck, Tempo, Container, Trailer, FCL HC/HCL, 20 GP, 40 GP, Special
}

export const TRAKET_VEHICLES = [
  // Domestic Fleet
  {
    id: 'Truck',
    label: 'Truck',
    group: 'Domestic',
    desc: '16ft to 32ft Open, Full Body, Half/Pona Dala & Heavy (10–40 MT)',
    icon: '🚛',
  },
  {
    id: 'Tempo',
    label: 'Tempo',
    group: 'Domestic',
    desc: '7ft to 17ft LCVs, Tata Ace, Bolero, Pickup (1–6 MT)',
    icon: '🚚',
  },
  {
    id: 'Container (Domestic)',
    label: 'Container (Domestic)',
    group: 'Domestic',
    desc: '20ft, 24ft, 32ft SXL & MXL Close Body Containers',
    icon: '📦',
  },
  {
    id: 'Trailer / ODC',
    label: 'Trailer / ODC',
    group: 'Domestic',
    desc: 'Flatbed, Lowbed, AMW 40 MT, Hydraulic & ODC',
    icon: '🚜',
  },

  // EXIM & Container Fleet
  {
    id: 'FCL 40 HC / HCL',
    label: 'FCL 40 HC / HCL',
    group: 'EXIM / FCL',
    desc: '40 High Cube (HC / HCL) Export & Import Shipping Containers',
    icon: '🚢',
  },
  {
    id: 'FCL 20 (20 GP)',
    label: 'FCL 20 (20 GP)',
    group: 'EXIM / FCL',
    desc: '20ft General Purpose (GP) Standard Shipping Containers',
    icon: '⚓',
  },
  {
    id: 'FCL 40 (40 GP)',
    label: 'FCL 40 (40 GP)',
    group: 'EXIM / FCL',
    desc: '40ft General Purpose (GP) Standard Shipping Containers',
    icon: '⛴️',
  },
  {
    id: 'Special Containers (Tank / Flexi / FR)',
    label: 'Special Containers',
    group: 'EXIM / FCL',
    desc: 'ISO Tank, Flexi Bag, Flat Rack (FR) & Reefer Containers',
    icon: '🛢️',
  },
] as const;

export type TraketVehicleType =
  | 'Truck'
  | 'Tempo'
  | 'Container (Domestic)'
  | 'Trailer / ODC'
  | 'FCL 40 HC / HCL'
  | 'FCL 20 (20 GP)'
  | 'FCL 40 (40 GP)'
  | 'Special Containers (Tank / Flexi / FR)';

export interface LeadAssignment {
  user_id: string;              // freight booking user_id
  assigned_to?: string;         // employee_id
  assigned_at?: string;
  transferred_from?: string;    // previous employee_id
  transfer_note?: string;
}

export interface SessionAssignment {
  user_id: string;
  assigned_to: string;          // employee_id
  assigned_name: string;        // employee name
  assigned_at: string;
}

export interface SessionReminderLog {
  user_id: string;
  r1_sent_at?: string;
  r2_sent_at?: string;
  r3_sent_at?: string;
  last_stage?: 1 | 2 | 3;
  last_message_id?: string;
}
