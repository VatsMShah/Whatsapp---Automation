require('dotenv').config();
const db = require('../src/services/supabase');

async function testUpsertBookVehicle() {
  const client = db.getClient();

  // Get the latest users_master record for 919323265076
  const { data: userRecord, error: uErr } = await client
    .from('users_master')
    .select('*')
    .eq('user_id', '919323265076_1793808335088')
    .single();

  if (uErr) {
    console.error('Error fetching user record:', uErr);
    return;
  }

  const parsedData = typeof userRecord.data === 'string' ? JSON.parse(userRecord.data) : userRecord.data;
  console.log('parsedData keys:', Object.keys(parsedData));

  const origin = parsedData.loadingYard || parsedData.stuffingAddress || parsedData.loadingPin || "";
  const destination = parsedData.unloadingAddress || parsedData.portCfs || parsedData.unloadingPin || "";

  let vehicleOrContainer = "";
  if (parsedData.fclType) {
    vehicleOrContainer = `${parsedData.fclType}${parsedData.containerType ? ` (${parsedData.containerType})` : ""}`;
  } else if (parsedData.vehicleType) {
    vehicleOrContainer = parsedData.vehicleType;
    if (parsedData.vehicleSubType) vehicleOrContainer += ` – ${parsedData.vehicleSubType}`;
    if (parsedData.bodyType) vehicleOrContainer += ` (${parsedData.bodyType})`;
  }

  const materialOrLine = parsedData.shippingLine || parsedData.material || "";

  let remarks = parsedData.remarks || "";
  if (parsedData.emptyYard && !remarks.includes(parsedData.emptyYard)) {
    remarks = remarks ? `Empty Yard: ${parsedData.emptyYard} | ${remarks}` : `Empty Yard: ${parsedData.emptyYard}`;
  }
  if (parsedData.alternatePhone && !remarks.includes(parsedData.alternatePhone)) {
    remarks = remarks ? `Alt Phone: ${parsedData.alternatePhone} | ${remarks}` : `Alt Phone: ${parsedData.alternatePhone}`;
  }

  const payload = {
    user_id: userRecord.user_id,
    phone: parsedData.phone || userRecord.phone,
    state: userRecord.state,
    cargo_type: parsedData.cargoType || "",
    origin: origin,
    destination: destination,
    vehicle_or_container: vehicleOrContainer,
    material_or_line: materialOrLine,
    weight: parsedData.weight || "",
    loading_date: parsedData.loadingDate || "",
    time_slot: parsedData.loadingTime || "",
    company_name: parsedData.company || "",
    contact_name: parsedData.contactName || "",
    email: parsedData.email || "",
    remarks: remarks,
    is_decision_maker: parsedData.isDecisionMaker !== undefined ? parsedData.isDecisionMaker : true,
    approver_name: parsedData.approverName || (parsedData.isDecisionMaker ? parsedData.contactName : ""),
    approver_phone: parsedData.approverPhone || (parsedData.isDecisionMaker ? (parsedData.phone || userRecord.phone) : ""),
    approver_role: parsedData.approverRole || (parsedData.isDecisionMaker ? "Decision Maker (Self)" : "Approver"),
    alternate_phone: parsedData.alternatePhone || (parsedData.isDecisionMaker === false ? parsedData.approverPhone : ""),
    flow_data: {
      loading_pin: parsedData.loadingPin || "",
      loading_location: parsedData.loadingLocation || "",
      loading_district: parsedData.loadingDistrict || "",
      unloading_pin: parsedData.unloadingPin || "",
      unloading_location: parsedData.unloadingLocation || "",
      unloading_district: parsedData.unloadingDistrict || "",
      vehicle_type: parsedData.vehicleType || "",
      vehicle_sub_type: parsedData.vehicleSubType || "",
      body_type: parsedData.bodyType || "",
      open_close: parsedData.openClose || "",
      trailer_bed_type: parsedData.trailerBedType || "",
      trailer_dim_type: parsedData.trailerDimType || "",
      fcl_type: parsedData.fclType || "",
      container_type: parsedData.containerType || "",
      shipping_line: parsedData.shippingLine || "",
      loading_yard: parsedData.loadingYard || "",
      unloading_address: parsedData.unloadingAddress || "",
      empty_yard: parsedData.emptyYard || "",
      stuffing_address: parsedData.stuffingAddress || "",
      port_cfs: parsedData.portCfs || "",
      cargo_dimensions: parsedData.dimensions || "",
      alternate_phone: parsedData.alternatePhone || "",
      is_decision_maker: parsedData.isDecisionMaker !== undefined ? parsedData.isDecisionMaker : true,
      approver_name: parsedData.approverName || "",
      approver_phone: parsedData.approverPhone || "",
      approver_role: parsedData.approverRole || "",
      submitter_name: parsedData.submitterName || parsedData.contactName || "",
      submitter_phone: parsedData.submitterPhone || parsedData.phone || userRecord.phone,
    },
    updated_at: userRecord.updated_at,
  };

  console.log('Attempting upsert into book_vehicle with payload:');
  const res = await client.from('book_vehicle').upsert(payload);
  console.log('Upsert result:', res);
}

testUpsertBookVehicle().catch(console.error);

