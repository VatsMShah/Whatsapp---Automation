/**
 * Indian Postal PIN Code & Route Intelligence Engine
 * Maps Indian PIN codes to Cities/States and estimates road distances
 */

interface PinInfo {
  city: string;
  state: string;
  region: string;
  lat: number;
  lng: number;
}

const PIN_PREFIX_MAP: Record<string, PinInfo> = {
  // --- Maharashtra ---
  '400': { city: 'Mumbai', state: 'Maharashtra', region: 'West', lat: 19.0760, lng: 72.8777 },
  '401': { city: 'Thane / Palghar', state: 'Maharashtra', region: 'West', lat: 19.2183, lng: 72.9781 },
  '402': { city: 'Raigad / Alibag', state: 'Maharashtra', region: 'West', lat: 18.6414, lng: 72.8722 },
  '403': { city: 'Goa', state: 'Goa', region: 'West', lat: 15.2993, lng: 74.1240 },
  '410': { city: 'Navi Mumbai / Panvel', state: 'Maharashtra', region: 'West', lat: 19.0330, lng: 73.0297 },
  '411': { city: 'Pune', state: 'Maharashtra', region: 'West', lat: 18.5204, lng: 73.8567 },
  '412': { city: 'Pune Rural', state: 'Maharashtra', region: 'West', lat: 18.5204, lng: 73.8567 },
  '413': { city: 'Solapur', state: 'Maharashtra', region: 'West', lat: 17.6599, lng: 75.9064 },
  '414': { city: 'Ahmednagar', state: 'Maharashtra', region: 'West', lat: 19.0948, lng: 74.7480 },
  '415': { city: 'Satara / Ratnagiri', state: 'Maharashtra', region: 'West', lat: 17.6805, lng: 74.0183 },
  '416': { city: 'Kolhapur / Sangli', state: 'Maharashtra', region: 'West', lat: 16.7050, lng: 74.2433 },
  '421': { city: 'Kalyan / Dombivli (Thane)', state: 'Maharashtra', region: 'West', lat: 19.2184, lng: 73.0867 },
  '422': { city: 'Nashik', state: 'Maharashtra', region: 'West', lat: 19.9975, lng: 73.7898 },
  '423': { city: 'Malegaon / Nashik Rural', state: 'Maharashtra', region: 'West', lat: 20.5579, lng: 74.5287 },
  '424': { city: 'Dhule', state: 'Maharashtra', region: 'West', lat: 20.9042, lng: 74.7749 },
  '425': { city: 'Jalgaon', state: 'Maharashtra', region: 'West', lat: 21.0077, lng: 75.5626 },
  '431': { city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', region: 'West', lat: 19.8762, lng: 75.3433 },
  '440': { city: 'Nagpur', state: 'Maharashtra', region: 'Central', lat: 21.1458, lng: 79.0882 },
  '444': { city: 'Amravati / Akola', state: 'Maharashtra', region: 'Central', lat: 20.9320, lng: 77.7523 },

  // --- Gujarat ---
  '380': { city: 'Ahmedabad', state: 'Gujarat', region: 'West', lat: 23.0225, lng: 72.5714 },
  '382': { city: 'Gandhinagar', state: 'Gujarat', region: 'West', lat: 23.2156, lng: 72.6369 },
  '384': { city: 'Mehsana / Patan', state: 'Gujarat', region: 'West', lat: 23.5880, lng: 72.3693 },
  '385': { city: 'Palanpur / Banaskantha', state: 'Gujarat', region: 'West', lat: 24.1724, lng: 72.4346 },
  '388': { city: 'Anand', state: 'Gujarat', region: 'West', lat: 22.5645, lng: 72.9289 },
  '390': { city: 'Vadodara', state: 'Gujarat', region: 'West', lat: 22.3072, lng: 73.1812 },
  '391': { city: 'Vadodara Rural', state: 'Gujarat', region: 'West', lat: 22.3072, lng: 73.1812 },
  '392': { city: 'Bharuch', state: 'Gujarat', region: 'West', lat: 21.7051, lng: 72.9959 },
  '393': { city: 'Ankleshwar', state: 'Gujarat', region: 'West', lat: 21.6264, lng: 73.0034 },
  '394': { city: 'Surat Rural', state: 'Gujarat', region: 'West', lat: 21.1702, lng: 72.8311 },
  '395': { city: 'Surat', state: 'Gujarat', region: 'West', lat: 21.1702, lng: 72.8311 },
  '396': { city: 'Vapi / Valsad', state: 'Gujarat', region: 'West', lat: 20.3893, lng: 72.9106 },
  '360': { city: 'Rajkot', state: 'Gujarat', region: 'West', lat: 22.3039, lng: 70.8022 },
  '361': { city: 'Jamnagar', state: 'Gujarat', region: 'West', lat: 22.4707, lng: 70.0577 },
  '362': { city: 'Junagadh', state: 'Gujarat', region: 'West', lat: 21.5222, lng: 70.4579 },
  '363': { city: 'Surendranagar / Morbi', state: 'Gujarat', region: 'West', lat: 22.7276, lng: 71.6370 },
  '364': { city: 'Bhavnagar', state: 'Gujarat', region: 'West', lat: 21.7645, lng: 72.1519 },
  '370': { city: 'Gandhidham / Kandla / Mundra', state: 'Gujarat', region: 'West', lat: 23.0753, lng: 70.1337 },

  // --- Delhi NCR & North ---
  '110': { city: 'Delhi', state: 'Delhi', region: 'North', lat: 28.6139, lng: 77.2090 },
  '121': { city: 'Faridabad', state: 'Haryana', region: 'North', lat: 28.4089, lng: 77.3178 },
  '122': { city: 'Gurugram', state: 'Haryana', region: 'North', lat: 28.4595, lng: 77.0266 },
  '124': { city: 'Rohtak', state: 'Haryana', region: 'North', lat: 28.8955, lng: 76.6066 },
  '131': { city: 'Sonipat', state: 'Haryana', region: 'North', lat: 28.9931, lng: 77.0151 },
  '132': { city: 'Panipat / Karnal', state: 'Haryana', region: 'North', lat: 29.3909, lng: 76.9635 },
  '133': { city: 'Ambala', state: 'Haryana', region: 'North', lat: 30.3782, lng: 76.7767 },
  '141': { city: 'Ludhiana', state: 'Punjab', region: 'North', lat: 30.9010, lng: 75.8573 },
  '143': { city: 'Amritsar', state: 'Punjab', region: 'North', lat: 31.6340, lng: 74.8723 },
  '144': { city: 'Jalandhar', state: 'Punjab', region: 'North', lat: 31.3260, lng: 75.5762 },
  '160': { city: 'Chandigarh', state: 'Chandigarh', region: 'North', lat: 30.7333, lng: 76.7794 },
  '201': { city: 'Noida / Ghaziabad', state: 'Uttar Pradesh', region: 'North', lat: 28.5355, lng: 77.3910 },
  '208': { city: 'Kanpur', state: 'Uttar Pradesh', region: 'North', lat: 26.4499, lng: 80.3319 },
  '226': { city: 'Lucknow', state: 'Uttar Pradesh', region: 'North', lat: 26.8467, lng: 80.9462 },
  '248': { city: 'Dehradun', state: 'Uttarakhand', region: 'North', lat: 30.3165, lng: 78.0322 },

  // --- Rajasthan ---
  '302': { city: 'Jaipur', state: 'Rajasthan', region: 'North', lat: 26.9124, lng: 75.7873 },
  '301': { city: 'Alwar / Bhiwadi', state: 'Rajasthan', region: 'North', lat: 27.5530, lng: 76.6346 },
  '305': { city: 'Ajmer', state: 'Rajasthan', region: 'North', lat: 26.4499, lng: 74.6399 },
  '311': { city: 'Bhilwara', state: 'Rajasthan', region: 'North', lat: 25.3407, lng: 74.6313 },
  '313': { city: 'Udaipur', state: 'Rajasthan', region: 'North', lat: 24.5854, lng: 73.7125 },
  '324': { city: 'Kota', state: 'Rajasthan', region: 'North', lat: 25.2138, lng: 75.8648 },
  '342': { city: 'Jodhpur', state: 'Rajasthan', region: 'North', lat: 26.2389, lng: 73.0243 },

  // --- Madhya Pradesh ---
  '452': { city: 'Indore', state: 'Madhya Pradesh', region: 'Central', lat: 22.7196, lng: 75.8577 },
  '456': { city: 'Ujjain', state: 'Madhya Pradesh', region: 'Central', lat: 23.1765, lng: 75.7885 },
  '462': { city: 'Bhopal', state: 'Madhya Pradesh', region: 'Central', lat: 23.2599, lng: 77.4126 },
  '474': { city: 'Gwalior', state: 'Madhya Pradesh', region: 'Central', lat: 26.2183, lng: 78.1828 },
  '482': { city: 'Jabalpur', state: 'Madhya Pradesh', region: 'Central', lat: 23.1815, lng: 79.9864 },

  // --- Karnataka ---
  '560': { city: 'Bengaluru', state: 'Karnataka', region: 'South', lat: 12.9716, lng: 77.5946 },
  '570': { city: 'Mysuru', state: 'Karnataka', region: 'South', lat: 12.2958, lng: 76.6394 },
  '575': { city: 'Mangaluru', state: 'Karnataka', region: 'South', lat: 12.9141, lng: 74.8560 },
  '580': { city: 'Hubballi / Dharwad', state: 'Karnataka', region: 'South', lat: 15.3647, lng: 75.1240 },
  '590': { city: 'Belagavi', state: 'Karnataka', region: 'South', lat: 15.8497, lng: 74.4977 },

  // --- Tamil Nadu & Kerala ---
  '600': { city: 'Chennai', state: 'Tamil Nadu', region: 'South', lat: 13.0827, lng: 80.2707 },
  '641': { city: 'Coimbatore', state: 'Tamil Nadu', region: 'South', lat: 11.0168, lng: 76.9558 },
  '625': { city: 'Madurai', state: 'Tamil Nadu', region: 'South', lat: 9.9252, lng: 78.1198 },
  '636': { city: 'Salem', state: 'Tamil Nadu', region: 'South', lat: 11.6643, lng: 78.1460 },
  '682': { city: 'Kochi', state: 'Kerala', region: 'South', lat: 9.9312, lng: 76.2673 },

  // --- Telangana & Andhra Pradesh ---
  '500': { city: 'Hyderabad', state: 'Telangana', region: 'South', lat: 17.3850, lng: 78.4867 },
  '520': { city: 'Vijayawada', state: 'Andhra Pradesh', region: 'South', lat: 16.5062, lng: 80.6480 },
  '530': { city: 'Visakhapatnam', state: 'Andhra Pradesh', region: 'South', lat: 17.6868, lng: 83.2185 },

  // --- West Bengal & East ---
  '700': { city: 'Kolkata', state: 'West Bengal', region: 'East', lat: 22.5726, lng: 88.3639 },
  '711': { city: 'Howrah', state: 'West Bengal', region: 'East', lat: 22.5958, lng: 78.2664 },
  '713': { city: 'Durgapur / Asansol', state: 'West Bengal', region: 'East', lat: 23.5204, lng: 87.3119 },
  '751': { city: 'Bhubaneswar', state: 'Odisha', region: 'East', lat: 20.2961, lng: 85.8245 },
  '800': { city: 'Patna', state: 'Bihar', region: 'East', lat: 25.5941, lng: 85.1376 },
  '834': { city: 'Ranchi / Jamshedpur', state: 'Jharkhand', region: 'East', lat: 23.3441, lng: 85.3096 },
  '781': { city: 'Guwahati', state: 'Assam', region: 'North-East', lat: 26.1445, lng: 91.7362 },
};

// 2-digit state fallback zones in India
const STATE_2DIGIT_MAP: Record<string, { state: string; lat: number; lng: number }> = {
  '11': { state: 'Delhi', lat: 28.61, lng: 77.20 },
  '12': { state: 'Haryana', lat: 28.45, lng: 77.02 },
  '13': { state: 'Haryana', lat: 29.39, lng: 76.96 },
  '14': { state: 'Punjab', lat: 30.90, lng: 75.85 },
  '15': { state: 'Punjab', lat: 30.21, lng: 74.95 },
  '16': { state: 'Chandigarh', lat: 30.73, lng: 76.77 },
  '17': { state: 'Himachal Pradesh', lat: 31.10, lng: 77.17 },
  '18': { state: 'Jammu & Kashmir', lat: 34.08, lng: 74.79 },
  '20': { state: 'Uttar Pradesh (West)', lat: 28.53, lng: 77.39 },
  '21': { state: 'Uttar Pradesh', lat: 27.17, lng: 78.00 },
  '22': { state: 'Uttar Pradesh (Central)', lat: 26.84, lng: 80.94 },
  '24': { state: 'Uttarakhand', lat: 30.31, lng: 78.03 },
  '30': { state: 'Rajasthan (Jaipur)', lat: 26.91, lng: 75.78 },
  '31': { state: 'Rajasthan (South)', lat: 24.58, lng: 73.71 },
  '32': { state: 'Rajasthan (Kota)', lat: 25.21, lng: 75.86 },
  '34': { state: 'Rajasthan (West)', lat: 26.23, lng: 73.02 },
  '36': { state: 'Gujarat (Saurashtra)', lat: 22.30, lng: 70.80 },
  '37': { state: 'Gujarat (Kutch / Mundra)', lat: 23.07, lng: 70.13 },
  '38': { state: 'Gujarat (North / Central)', lat: 23.02, lng: 72.57 },
  '39': { state: 'Gujarat (South)', lat: 21.17, lng: 72.83 },
  '40': { state: 'Maharashtra (Mumbai MMR)', lat: 19.07, lng: 72.87 },
  '41': { state: 'Maharashtra (Pune Region)', lat: 18.52, lng: 73.85 },
  '42': { state: 'Maharashtra (Kalyan / Nashik Region)', lat: 19.21, lng: 73.08 },
  '43': { state: 'Maharashtra (Marathwada)', lat: 19.87, lng: 75.34 },
  '44': { state: 'Maharashtra (Vidarbha)', lat: 21.14, lng: 79.08 },
  '45': { state: 'Madhya Pradesh (Malwa)', lat: 22.71, lng: 75.85 },
  '46': { state: 'Madhya Pradesh (Bhopal)', lat: 23.25, lng: 77.41 },
  '50': { state: 'Telangana', lat: 17.38, lng: 78.48 },
  '51': { state: 'Andhra Pradesh (Rayalaseema)', lat: 14.46, lng: 78.82 },
  '52': { state: 'Andhra Pradesh (Coastal)', lat: 16.50, lng: 80.64 },
  '53': { state: 'Andhra Pradesh (North)', lat: 17.68, lng: 83.21 },
  '56': { state: 'Karnataka (Bengaluru)', lat: 12.97, lng: 77.59 },
  '57': { state: 'Karnataka (Coastal / South)', lat: 12.91, lng: 74.85 },
  '58': { state: 'Karnataka (North)', lat: 15.36, lng: 75.12 },
  '60': { state: 'Tamil Nadu (Chennai)', lat: 13.08, lng: 80.27 },
  '64': { state: 'Tamil Nadu (West)', lat: 11.01, lng: 76.95 },
  '68': { state: 'Kerala', lat: 9.93, lng: 76.26 },
  '70': { state: 'West Bengal (Kolkata)', lat: 22.57, lng: 88.36 },
  '75': { state: 'Odisha', lat: 20.29, lng: 85.82 },
  '80': { state: 'Bihar', lat: 25.59, lng: 85.13 },
  '83': { state: 'Jharkhand', lat: 23.34, lng: 85.30 },
};

export function resolvePinCode(pin: string): { city: string; state: string; label: string } {
  if (!pin || pin.trim().length === 0) {
    return { city: 'Unknown', state: 'India', label: 'India' };
  }

  const raw = pin.trim();
  const digits = raw.replace(/[^0-9]/g, '');

  // If it's a named place (e.g., 'Mundra Port', 'JNPT CFS', 'Hazira')
  if (digits.length < 3) {
    return { city: raw, state: 'India', label: raw };
  }

  // 1. Direct 3-digit prefix lookup
  const prefix3 = digits.slice(0, 3);
  const info3 = PIN_PREFIX_MAP[prefix3];
  if (info3) {
    return {
      city: info3.city,
      state: info3.state,
      label: `${info3.city}, ${info3.state}`,
    };
  }

  // 2. 2-digit regional fallback lookup
  const prefix2 = digits.slice(0, 2);
  const info2 = STATE_2DIGIT_MAP[prefix2];
  if (info2) {
    return {
      city: info2.state,
      state: info2.state,
      label: `${info2.state} (${digits})`,
    };
  }

  return { city: digits, state: 'India', label: `PIN ${digits}` };
}

// Calculate road distance estimation between two pins (Haversine + Indian highway winding factor 1.25)
export function estimateDistanceKm(loadingPin: string, unloadingPin: string): number {
  const d1 = (loadingPin || '').replace(/[^0-9]/g, '');
  const d2 = (unloadingPin || '').replace(/[^0-9]/g, '');

  const p1 =
    PIN_PREFIX_MAP[d1.slice(0, 3)] ||
    STATE_2DIGIT_MAP[d1.slice(0, 2)];
  const p2 =
    PIN_PREFIX_MAP[d2.slice(0, 3)] ||
    STATE_2DIGIT_MAP[d2.slice(0, 2)];

  if (!p1 || !p2) {
    return 850; // Fallback average interstate distance
  }

  const R = 6371; // Earth radius in km
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * (Math.PI / 180)) *
      Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const crowDistance = R * c;

  // Road factor is usually 1.22x - 1.30x crow-fly distance in India
  return Math.round(crowDistance * 1.25);
}

export function calculateLeadScore(material: string, loadingDate: string, cargoType: string): 'HOT' | 'WARM' | 'COLD' {
  const lowerMaterial = (material || '').toLowerCase();
  
  if (
    lowerMaterial.includes('machine') ||
    lowerMaterial.includes('urgent') ||
    lowerMaterial.includes('steel') ||
    lowerMaterial.includes('pharma') ||
    cargoType === 'Export' ||
    cargoType === 'Import'
  ) {
    return 'HOT';
  }

  if (loadingDate && loadingDate !== 'NA') {
    return 'WARM';
  }

  return 'COLD';
}
