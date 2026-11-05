require('dotenv').config();
const db = require('../src/services/supabase');

async function fixBothLeads() {
  const client = db.getClient();

  // 1. Restore yesterday's lead (sachin / suraj - jolar)
  const yesterdayLead = {
    user_id: '919323265076_1793808335088',
    phone: '919323265076',
    state: 'cta_menu',
    cargo_type: 'Domestic',
    origin: '411002',
    destination: '560001',
    vehicle_or_container: 'Trailer / ODC – 3518 (27 MT)',
    material_or_line: 'dance',
    weight: '27 MT',
    loading_date: '04/11/2077',
    time_slot: 'Slot 1 (07:00 AM - 02:00 PM)',
    company_name: 'youth',
    contact_name: 'sachin',
    is_decision_maker: false,
    approver_name: 'suraj - jolar',
    approver_phone: '+91 7722113322',
    approver_role: 'Approver',
    alternate_phone: '+91 7722113322',
    flow_data: {
      loading_pin: '411002',
      loading_location: 'Bajirao Road, Pune (Maharashtra)',
      loading_district: 'Pune',
      unloading_pin: '560001',
      unloading_location: 'Bangalore (Karnataka)',
      unloading_district: 'Bangalore',
      vehicle_type: 'Trailer / ODC',
      vehicle_sub_type: '3518 (27 MT)',
      trailer_bed_type: 'Highbed',
      trailer_dim_type: 'Over Dimension (ODC)',
      cargo_dimensions: '40 x 8 x 7 Ft',
      material: 'dance',
      weight: '27 MT',
      is_decision_maker: false,
      approver_name: 'suraj - jolar',
      approver_phone: '+91 7722113322',
      approver_role: 'Approver',
      submitter_name: 'sachin',
      submitter_phone: '+91 9323265076',
    },
    updated_at: '2026-11-04T16:09:09.354+00:00',
  };

  console.log('Restoring yesterday lead...');
  const res1 = await client.from('book_vehicle').upsert(yesterdayLead);
  console.log('Yesterday lead in book_vehicle:', res1.status);

  // 2. Insert today's 5:14 AM lead (HONEY / 1 MT / Kolkata -> Hyderabad)
  const todayLeadId = '919323265076_1793873680247';
  const todayData = {
    email: '',
    phone: '919323265076',
    weight: '1 MT',
    company: 'panda',
    bodyType: 'Cover / Closed',
    material: 'Silver steppers',
    cargoType: 'Domestic',
    dimensions: '40 x 8 x 7 Ft',
    loadingPin: '700001',
    contactName: 'HONEY',
    loadingDate: '05/12/2026',
    loadingTime: 'Slot 1 (07:00 AM - 02:00 PM)',
    vehicleType: 'Tempo',
    approverName: 'HONEY',
    approverRole: 'Decision Maker (Self)',
    loadingState: 'West Bengal',
    unloadingPin: '500001',
    approverPhone: '+91 9323265076',
    submitterName: 'HONEY',
    alternatePhone: '+91 7722113322',
    submitterPhone: '+91 9323265076',
    trailerBedType: 'Highbed',
    trailerDimType: 'Over Dimension (ODC)',
    unloadingState: 'Telangana',
    vehicleSubType: '1 MT (8x5x5 ft)',
    isDecisionMaker: true,
    loadingDistrict: 'Kolkata',
    loadingLocation: 'Council House Street, Kolkata (West Bengal)',
    unloadingDistrict: 'Hyderabad',
    unloadingLocation: 'Gandhi Bhawan (Hyderabad), Hyderabad (Telangana)',
  };

  const todayLead = {
    user_id: todayLeadId,
    phone: '919323265076',
    state: 'cta_menu',
    cargo_type: 'Domestic',
    origin: '700001',
    destination: '500001',
    vehicle_or_container: 'Tempo – 1 MT (8x5x5 ft) (Cover / Closed)',
    material_or_line: 'Silver steppers',
    weight: '1 MT',
    loading_date: '05/12/2026',
    time_slot: 'Slot 1 (07:00 AM - 02:00 PM)',
    company_name: 'panda',
    contact_name: 'HONEY',
    is_decision_maker: true,
    approver_name: 'HONEY',
    approver_phone: '+91 9323265076',
    approver_role: 'Decision Maker (Self)',
    alternate_phone: '+91 7722113322',
    flow_data: {
      loading_pin: '700001',
      loading_location: 'Council House Street, Kolkata (West Bengal)',
      loading_district: 'Kolkata',
      unloading_pin: '500001',
      unloading_location: 'Gandhi Bhawan (Hyderabad), Hyderabad (Telangana)',
      unloading_district: 'Hyderabad',
      vehicle_type: 'Tempo',
      vehicle_sub_type: '1 MT (8x5x5 ft)',
      body_type: 'Cover / Closed',
      trailer_bed_type: 'Highbed',
      trailer_dim_type: 'Over Dimension (ODC)',
      cargo_dimensions: '40 x 8 x 7 Ft',
      material: 'Silver steppers',
      weight: '1 MT',
      alternate_phone: '+91 7722113322',
      is_decision_maker: true,
      approver_name: 'HONEY',
      approver_phone: '+91 9323265076',
      approver_role: 'Decision Maker (Self)',
      submitter_name: 'HONEY',
      submitter_phone: '+91 9323265076',
    },
    updated_at: '2026-11-05T10:14:40.247+00:00',
  };

  console.log('Inserting today lead in book_vehicle...');
  const res2 = await client.from('book_vehicle').upsert(todayLead);
  console.log('Today lead in book_vehicle:', res2.status);

  console.log('Inserting today lead in users_master...');
  const res3 = await client.from('users_master').upsert({
    user_id: todayLeadId,
    phone: '919323265076',
    state: 'cta_menu',
    flow_type: 'book',
    updated_at: '2026-11-05T10:14:40.247+00:00',
    data: todayData,
  });
  console.log('Today lead in users_master:', res3.status);
}

fixBothLeads().catch(console.error);

