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

export type DashboardTab = 'orders' | 'overview' | 'inquiries' | 'team' | 'backup';

export interface BackupStats {
  status: 'active' | 'error';
  lastBackupAt: string;
  backupDirectory?: string;
  counts: {
    book_vehicle: number;
    users_master: number;
    provide_vehicle: number;
    support: number;
    total: number;
  };
  pendingSupabaseSync: number;
  supabase: {
    online: boolean;
    error?: string;
  };
  googleSheets: {
    configured: boolean;
    sheetId?: string | null;
  };
}

export interface Employee {
  id: string;           // UUID primary key
  employee_id: string;  // Human-readable e.g. EMP001
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  is_active: boolean;
  created_at: string;
}

export interface LeadAssignment {
  user_id: string;              // freight booking user_id
  assigned_to?: string;         // employee_id
  assigned_at?: string;
  transferred_from?: string;    // previous employee_id
  transfer_note?: string;
}
