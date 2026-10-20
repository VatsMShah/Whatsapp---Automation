/**
 * Indian Postal PIN Code & Route Intelligence Engine
 * Maps 6-digit PIN codes to Cities/States and estimates road distances
 */

interface PinInfo {
  city: string;
  state: string;
  region: string;
  lat: number;
  lng: number;
}

const PIN_PREFIX_MAP: Record<string, PinInfo> = {
  // Maharashtra
  '400': { city: 'Mumbai', state: 'Maharashtra', region: 'West', lat: 19.0760, lng: 72.8777 },
  '401': { city: 'Thane / Palghar', state: 'Maharashtra', region: 'West', lat: 19.2183, lng: 72.9781 },
  '410': { city: 'Navi Mumbai / Raigad', state: 'Maharashtra', region: 'West', lat: 19.0330, lng: 73.0297 },
  '411': { city: 'Pune', state: 'Maharashtra', region: 'West', lat: 18.5204, lng: 73.8567 },
  '412': { city: 'Pune Rural', state: 'Maharashtra', region: 'West', lat: 18.5204, lng: 73.8567 },
  '422': { city: 'Nashik', state: 'Maharashtra', region: 'West', lat: 19.9975, lng: 73.7898 },
  '431': { city: 'Aurangabad / Chhatrapati Sambhajinagar', state: 'Maharashtra', region: 'West', lat: 19.8762, lng: 75.3433 },
  '440': { city: 'Nagpur', state: 'Maharashtra', region: 'Central', lat: 21.1458, lng: 79.0882 },

  // Gujarat
  '380': { city: 'Ahmedabad', state: 'Gujarat', region: 'West', lat: 23.0225, lng: 72.5714 },
  '390': { city: 'Vadodara', state: 'Gujarat', region: 'West', lat: 22.3072, lng: 73.1812 },
  '395': { city: 'Surat', state: 'Gujarat', region: 'West', lat: 21.1702, lng: 72.8311 },
  '360': { city: 'Rajkot', state: 'Gujarat', region: 'West', lat: 22.3039, lng: 70.8022 },
  '370': { city: 'Gandhidham / Kandla Port', state: 'Gujarat', region: 'West', lat: 23.0753, lng: 70.1337 },

  // Delhi NCR
  '110': { city: 'New Delhi', state: 'Delhi NCR', region: 'North', lat: 28.6139, lng: 77.2090 },
  '122': { city: 'Gurugram', state: 'Haryana', region: 'North', lat: 28.4595, lng: 77.0266 },
  '121': { city: 'Faridabad', state: 'Haryana', region: 'North', lat: 28.4089, lng: 77.3178 },
  '201': { city: 'Noida / Ghaziabad', state: 'Uttar Pradesh', region: 'North', lat: 28.5355, lng: 77.3910 },

  // Karnataka
  '560': { city: 'Bengaluru', state: 'Karnataka', region: 'South', lat: 12.9716, lng: 77.5946 },
  '570': { city: 'Mysuru', state: 'Karnataka', region: 'South', lat: 12.2958, lng: 76.6394 },
  '580': { city: 'Hubli-Dharwad', state: 'Karnataka', region: 'South', lat: 15.3647, lng: 75.1240 },

  // Tamil Nadu
  '600': { city: 'Chennai', state: 'Tamil Nadu', region: 'South', lat: 13.0827, lng: 80.2707 },
  '641': { city: 'Coimbatore', state: 'Tamil Nadu', region: 'South', lat: 11.0168, lng: 76.9558 },

  // Telangana / Andhra Pradesh
  '500': { city: 'Hyderabad', state: 'Telangana', region: 'South', lat: 17.3850, lng: 78.4867 },
  '530': { city: 'Visakhapatnam', state: 'Andhra Pradesh', region: 'South', lat: 17.6868, lng: 83.2185 },

  // Rajasthan
  '302': { city: 'Jaipur', state: 'Rajasthan', region: 'North', lat: 26.9124, lng: 75.7873 },
  '342': { city: 'Jodhpur', state: 'Rajasthan', region: 'North', lat: 26.2389, lng: 73.0243 },

  // Madhya Pradesh
  '452': { city: 'Indore', state: 'Madhya Pradesh', region: 'Central', lat: 22.7196, lng: 75.8577 },
  '462': { city: 'Bhopal', state: 'Madhya Pradesh', region: 'Central', lat: 23.2599, lng: 77.4126 },

  // West Bengal
  '700': { city: 'Kolkata', state: 'West Bengal', region: 'East', lat: 22.5726, lng: 88.3639 },
};

export function resolvePinCode(pin: string): { city: string; state: string; label: string } {
  if (!pin || pin.length < 3) {
    return { city: 'Unknown', state: 'India', label: 'India' };
  }
  const prefix = pin.slice(0, 3);
  const info = PIN_PREFIX_MAP[prefix];
  if (info) {
    return {
      city: info.city,
      state: info.state,
      label: `${info.city}, ${info.state}`,
    };
  }
  return { city: `PIN ${pin}`, state: 'India', label: `PIN ${pin}` };
}

// Calculate road distance estimation between two pins (Haversine + winding factor 1.25)
export function estimateDistanceKm(loadingPin: string, unloadingPin: string): number {
  const p1 = PIN_PREFIX_MAP[loadingPin?.slice(0, 3)];
  const p2 = PIN_PREFIX_MAP[unloadingPin?.slice(0, 3)];

  if (!p1 || !p2) {
    return 450; // Fallback default average distance
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

  // Road factor is usually 1.25x - 1.35x crow fly distance in India
  return Math.round(crowDistance * 1.28);
}

export function calculateLeadScore(material: string, loadingDate: string, cargoType: string): 'HOT' | 'WARM' | 'COLD' {
  const lowerMaterial = (material || '').toLowerCase();
  
  // Urgent or commercial cargo keywords
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
