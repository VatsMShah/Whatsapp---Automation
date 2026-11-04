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
  vehicle_sub_type?: string;

  // Decision-Maker vs Submitter separation
  is_decision_maker?: boolean;
  approver_name?: string;
  approver_phone?: string;
  approver_role?: string;
  submitter_name?: string;
  submitter_phone?: string;
  
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
  assigned_subtypes?: string[]; // Granular sub-capacities & sizes (e.g. 1 MT, 10 MT, 20 MT, 32 Ft SXL, etc.)
}

export interface VehicleSubtype {
  id: string;
  label: string;
  size?: string;
  desc?: string;
  weight?: string;
}

export interface VehicleDefinition {
  id: TraketVehicleType;
  label: string;
  group: 'Domestic' | 'EXIM / FCL';
  desc: string;
  icon: string;
  subtypes: VehicleSubtype[];
}

export const TRAKET_VEHICLES: VehicleDefinition[] = [
  // Domestic Fleet (Directly from WhatsApp List: "Select Vehicle Type")
  {
    id: 'Tempo',
    label: 'Tempo',
    group: 'Domestic',
    desc: 'For small loads (1 - 10 MT)',
    icon: '🚚',
    subtypes: [
      { id: '1 MT', label: '1 MT', size: '8 × 5 × 5 ft', weight: '1 MT', desc: 'Size: 8 × 5 × 5 ft' },
      { id: '3 MT', label: '3 MT', size: '14 × 6 × 6 ft', weight: '3 MT', desc: 'Size: 14 × 6 × 6 ft' },
      { id: '6 MT', label: '6 MT', size: '19 × 7 × 7 ft', weight: '6 MT', desc: 'Size: 19 × 7 × 7 ft' },
      { id: '10 MT', label: '10 MT', size: '20 × 7 × 7 ft', weight: '10 MT', desc: 'Size: 20 × 7 × 7 ft' },
    ],
  },
  {
    id: 'Truck',
    label: 'Truck',
    group: 'Domestic',
    desc: 'Open / Closed (12 - 40 MT)',
    icon: '🚛',
    subtypes: [
      { id: '12 MT', label: '12 MT', size: '22 × 7 × 7 ft', weight: '12 MT', desc: 'Size: 22 × 7 × 7 ft' },
      { id: '18 MT', label: '18 MT', size: '22 × 7 × 7 ft', weight: '18 MT', desc: 'Size: 22 × 7 × 7 ft' },
      { id: '25 MT', label: '25 MT', size: '24 × 7 × 7 ft', weight: '25 MT', desc: 'Size: 24 × 7 × 7 ft' },
      { id: '30 MT', label: '30 MT', size: '28 × 7 × 7 ft', weight: '30 MT', desc: 'Size: 28 × 7 × 7 ft' },
      { id: '35 MT', label: '35 MT', size: '30 × 7 × 7 ft', weight: '35 MT', desc: 'Size: 30 × 7 × 7 ft' },
      { id: '40 MT', label: '40 MT', size: '32 × 7 × 7 ft', weight: '40 MT', desc: 'Size: 32 × 7 × 7 ft' },
    ],
  },
  {
    id: 'Container (Domestic)',
    label: 'Container (Domestic)',
    group: 'Domestic',
    desc: '32 Ft SXL / MXL Close Body',
    icon: '📦',
    subtypes: [
      { id: '32 Ft SXL 07 - 10 MT', label: '32 Ft SXL 07 - 10 MT', size: '32 × 8 × 9 ft', weight: '7–10 MT', desc: '6 Tyre (Size: 32 × 8 × 9 ft)' },
      { id: '32 Ft MXL 15 - 18 MT', label: '32 Ft MXL 15 - 18 MT', size: '32 × 8 × 9 ft', weight: '15–18 MT', desc: '10 Tyre (Size: 32 × 8 × 9 ft)' },
      { id: '32 Ft MXL 21 - 25 MT', label: '32 Ft MXL 21 - 25 MT', size: '32 × 8 × 9 ft', weight: '12 Tyre (Size: 32 × 8 × 9 ft)' },
      { id: '32 Ft MXL 28 - 30 MT', label: '32 Ft MXL 28 - 30 MT', size: '32 × 8 × 9 ft', weight: '14 Tyre (Size: 32 × 8 × 9 ft)' },
    ],
  },
  {
    id: 'Trailer / ODC',
    label: 'Trailer / ODC',
    group: 'Domestic',
    desc: 'Trailer & Over Dimension',
    icon: '🚜',
    subtypes: [
      { id: '3518 (27 MT)', label: '3518 (27 MT)', size: '40 × 8 × 7 ft', weight: '27 MT', desc: 'Gross Capacity: 27 MT' },
      { id: '4018 (33 MT)', label: '4018 (33 MT)', size: '40 × 8 × 7 ft', weight: '33 MT', desc: 'Gross Capacity: 33 MT' },
      { id: 'AMW (40 MT)', label: 'AMW (40 MT)', size: '40 × 8 × 7 ft', weight: '40 MT', desc: 'Heavy Haulage: 40 MT' },
    ],
  },

  // EXIM / Port Logistics Fleet (Directly from WhatsApp FCL Flow)
  {
    id: 'FCL 20',
    label: 'FCL 20',
    group: 'EXIM / FCL',
    desc: '20ft Export / Import (20 GP, 20 FLEXI, 20 TANK)',
    icon: '⚓',
    subtypes: [
      { id: '6 Tyre Tuskar (07 MT + Container)', label: '6 Tyre Tuskar (07 MT)', size: '20 × 8 × 8.5 ft', weight: '7 MT', desc: 'For 20 GP' },
      { id: '10 Tyre Taurus (16 MT + Container)', label: '10 Tyre Taurus (16 MT)', size: '20 × 8 × 8.5 ft', weight: '16 MT', desc: 'For 20 GP' },
      { id: '12 Tyre Taurus (22 MT + Container)', label: '12 Tyre Taurus (22 MT)', size: '20 × 8 × 8.5 ft', weight: '22 MT', desc: 'For 20 GP' },
      { id: '14 Tyre Taurus (28 MT + Container)', label: '14 Tyre Taurus (28 MT)', size: '20 × 8 × 8.5 ft', weight: '28 MT', desc: 'For 20 GP' },
      { id: '4018 Trailer (30 MT + Container)', label: '4018 Trailer (30 MT)', size: '20 × 8 × 8.5 ft', weight: '30 MT', desc: 'For 20 GP' },
      { id: '20 FLEXI Container', label: '20 FLEXI Container', size: '20 × 8 × 8.5 ft', weight: '18–24 MT', desc: '20 FLEXI Container' },
      { id: '20 TANK Container', label: '20 TANK Container', size: '20 × 8 × 8.5 ft', weight: '20–26 MT', desc: '20 TANK Container' },
    ],
  },
  {
    id: 'FCL 40',
    label: 'FCL 40',
    group: 'EXIM / FCL',
    desc: '40ft Export / Import (40 HC, 40 Open Top, 40 FR)',
    icon: '🚢',
    subtypes: [
      { id: '3518 (24 MT + Container)', label: '3518 (24 MT)', size: '40 × 8 × 9.5 ft', weight: '24 MT', desc: 'For 40 HC / Open Top / FR' },
      { id: '4018 (29 MT + Container)', label: '4018 (29 MT)', size: '40 × 8 × 9.5 ft', weight: '29 MT', desc: 'For 40 HC / Open Top / FR' },
      { id: 'AMW (30 MT + Container)', label: 'AMW (30 MT)', size: '40 × 8 × 9.5 ft', weight: '30 MT', desc: 'For 40 HC / Open Top / FR' },
    ],
  },
];

export type TraketVehicleType =
  | 'Tempo'
  | 'Truck'
  | 'Container (Domestic)'
  | 'Trailer / ODC'
  | 'FCL 20'
  | 'FCL 40';

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

export interface LeadNotification {
  id: string;
  bookingId: string;
  title: string;
  customerName: string;
  phone: string;
  companyName?: string;
  origin: string;
  destination: string;
  vehicleType: string;
  material?: string;
  weight?: string;
  assignedTo?: string;
  assignedAt?: string;
  createdAt: string;
  status: 'pending' | 'viewed' | 'dismissed';
  urgency: 'high' | 'normal' | 'urgent';
  type: 'new_lead' | 'sla_reminder';
  isDecisionMaker?: boolean;
  approverName?: string;
  approverPhone?: string;
  approverRole?: string;
}

