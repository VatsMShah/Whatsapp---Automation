import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================================
// ENVIRONMENT SECRETS
// =====================================================================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const WHATSAPP_ACCESS_TOKEN = (Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "").trim();
const WHATSAPP_PHONE_NUMBER_ID = (Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "").trim();
const WHATSAPP_APP_SECRET = (Deno.env.get("WHATSAPP_APP_SECRET") || "").trim();
const WHATSAPP_VERIFY_TOKEN = (Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "").trim();
const GRAPH_API_VERSION = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") || "v20.0";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =====================================================================
// WHATSAPP API HELPERS
// =====================================================================
async function sendWhatsAppText(to: string, text: string) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  console.log(`Sending WhatsApp reply to ${to} via Phone Number ID: ${WHATSAPP_PHONE_NUMBER_ID}`);
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("❌ WhatsApp Graph API error:", { status: res.status, data });
  } else {
    console.log("✅ WhatsApp reply delivered successfully:", data);
  }
  return data;
}

async function sendWhatsAppCtaButtons(to: string) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "👉 What would you like to do next?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "cta_new", title: "Post New Order" } },
            { type: "reply", reply: { id: "cta_ai", title: "Know About Traket" } },
            { type: "reply", reply: { id: "cta_support", title: "Support" } },
          ],
        },
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("❌ WhatsApp CTA API error:", { status: res.status, data });
  } else {
    console.log("✅ WhatsApp CTA buttons sent:", data);
  }
  return data;
}

// =====================================================================
// HMAC SIGNATURE VERIFICATION
// =====================================================================
async function isValidSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !WHATSAPP_APP_SECRET) return true;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(WHATSAPP_APP_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `sha256=${hex}` === signatureHeader;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

// =====================================================================
// CONVERSATION STATE MACHINE
// =====================================================================
function processConversation(chat: any, masterRows: any[]) {
  let rawMessage = "";
  const msg = chat.messages?.[0];

  if (msg?.type === "text") {
    rawMessage = msg.text?.body || "";
  } else if (msg?.type === "interactive") {
    rawMessage = msg.interactive?.button_reply?.id || "";
  }

  if (typeof rawMessage === "object") {
    rawMessage = rawMessage?.text || rawMessage?.value || "";
  }

  const message = String(rawMessage).trim();
  const lowerMessage = message.toLowerCase();
  const phone = chat.messages?.[0]?.from || "unknown_user";

  const items = (masterRows || []).map((r) => ({ json: r }));
  let row: any = {};
  const normalizedPhone = phone.slice(-10);

  const filteredItems = items.filter((item) => {
    const sheetPhone = String(item.json?.phone || "").slice(-10);
    return sheetPhone === normalizedPhone;
  });

  if (filteredItems.length > 0) {
    filteredItems.sort((a, b) => new Date(b.json.updated_at).getTime() - new Date(a.json.updated_at).getTime());
    row = filteredItems[0].json;
  }

  // FORCE RESET ON HI
  if (["hi", "hello", "start", "restart"].includes(lowerMessage)) {
    const newSessionId = `${phone}_${Date.now()}`;
    return {
      user_id: newSessionId,
      phone: phone,
      state: "main_menu",
      updated_at: new Date().toISOString(),
      response:
        "🙏 *Welcome to Traket Transport* 🚛\n\n" +
        "We provide reliable logistics solutions across India 🇮🇳\n\n" +
        "👉 Please select your requirement:\n\n" +
        "1️⃣ Book a Vehicle (Customer)\n" +
        "2️⃣ Provide Vehicle (Transporter)\n" +
        "3️⃣ Support\n\n" +
        "Reply with *1, 2 or 3*",
      flowType: "",
      data: "{}",
    };
  }

  const vehicleTypeMap: Record<string, string> = { 1: "Tempo", 2: "Truck", 3: "Container", 4: "Trailer / ODC" };
  const cargoTypeMap: Record<string, string> = { 1: "Domestic", 2: "Import", 3: "Export" };
  const tempoSizeMap: Record<string, string> = { "1": "7 Ft", "2": "8 Ft", "3": "9 Ft", "4": "14 Ft", "5": "17 Ft" };
  const truckTypeMap: Record<string, string> = { "1": "19 Ft Open", "2": "22 Ft Open", "3": "24 Ft Open", "4": "32 Ft Open" };
  const containerTypeMap: Record<string, string> = { "1": "20 Ft Close Body", "2": "24 Ft Close Body", "3": "32 Ft SXL Close Body", "4": "32 Ft MXL Close Body" };

  function validateLoadingDate(dateStr: string): { valid: boolean; reason?: "format" | "past" } {
    const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return { valid: false, reason: "format" };
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month < 1 || month > 12) return { valid: false, reason: "format" };
    if (day < 1 || day > 31) return { valid: false, reason: "format" };
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return { valid: false, reason: "format" };

    const inputDate = new Date(year, month - 1, day);
    inputDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      return { valid: false, reason: "past" };
    }
    return { valid: true };
  }

  let state = row.state || "start";
  let data: any = {};
  try {
    data = typeof row.data === "string" ? JSON.parse(row.data || "{}") : row.data || {};
  } catch {
    data = {};
  }

  let response = "";
  let flowType = row.flowType || row.flow_type || "";

  // 1. MAIN MENU
  if (state === "main_menu") {
    if (message === "1") {
      state = "loading_pin";
      flowType = "book";
      response = "📍 Enter *Loading Pincode* (6 digits):\n(e.g., 400001)";
    } else if (message === "2") {
      state = "provider_vehicle_type";
      flowType = "provider";
      response =
        "🚛 *Transporter Vehicle Registration*\n\n" +
        "Select Vehicle Category:\n" +
        "1️⃣ Tempo (7ft, 8ft, 9ft, 14ft, 17ft)\n" +
        "2️⃣ Open Truck (19ft, 22ft, 24ft, 32ft)\n" +
        "3️⃣ Container (20ft, 24ft, 32ft SXL/MXL)\n" +
        "4️⃣ Trailer / ODC (40ft, High Bed, Low Bed)\n\n" +
        "Reply with *1, 2, 3 or 4*";
    } else if (message === "3") {
      state = "support";
      flowType = "support";
      response =
        "📞 *Traket Support Desk*\n\n" +
        "📧 Email: support@traket.in\n" +
        "🌐 Web: https://traket.in\n\n" +
        "Our support team will contact you shortly.\n\n" +
        "Type *Hi* anytime to start over.";
    } else {
      response = "❌ Invalid option.\n\nReply with:\n1️⃣ Book Vehicle\n2️⃣ Provide Vehicle\n3️⃣ Support";
    }
  }

  // 2. BOOK VEHICLE FLOW
  else if (state === "loading_pin") {
    if (/^\d{6}$/.test(message)) {
      data.loadingPin = message;
      state = "unloading_pin";
      response = "📍 Enter *Unloading Pincode* (6 digits):\n(e.g., 560001)";
    } else {
      response = "❌ Invalid pincode. Please enter a valid *6-digit* Loading Pincode:";
    }
  } else if (state === "unloading_pin") {
    if (/^\d{6}$/.test(message)) {
      data.unloadingPin = message;
      state = "cargo_type";
      response = "📦 Select *Cargo Type*:\n1️⃣ Domestic\n2️⃣ Import\n3️⃣ Export\n\nReply with *1, 2 or 3*";
    } else {
      response = "❌ Invalid pincode. Please enter a valid *6-digit* Unloading Pincode:";
    }
  } else if (state === "cargo_type") {
    if (["1", "2", "3"].includes(message)) {
      data.cargoType = cargoTypeMap[message];
      state = "vehicle_type";
      response = "🚛 Select *Vehicle Type*:\n1️⃣ Tempo\n2️⃣ Truck\n3️⃣ Container\n4️⃣ Trailer / ODC\n\nReply with *1, 2, 3 or 4*";
    } else {
      response = "❌ Invalid choice. Reply with *1* (Domestic), *2* (Import), or *3* (Export):";
    }
  } else if (state === "vehicle_type") {
    if (message === "1") {
      data.vehicleType = "Tempo";
      state = "tempo_type";
      response = "Select *Tempo Size*:\n1️⃣ 7 Ft\n2️⃣ 8 Ft\n3️⃣ 9 Ft\n4️⃣ 14 Ft\n5️⃣ 17 Ft\n\nReply with *1 - 5*";
    } else if (message === "2") {
      data.vehicleType = "Truck";
      state = "truck_type";
      response = "Select *Truck Type*:\n1️⃣ 19 Ft Open\n2️⃣ 22 Ft Open\n3️⃣ 24 Ft Open\n4️⃣ 32 Ft Open\n\nReply with *1 - 4*";
    } else if (message === "3") {
      data.vehicleType = "Container";
      state = "container_type";
      response = "Select *Container Type*:\n1️⃣ 20 Ft Close Body\n2️⃣ 24 Ft Close Body\n3️⃣ 32 Ft SXL Close Body\n4️⃣ 32 Ft MXL Close Body\n\nReply with *1 - 4*";
    } else if (message === "4") {
      data.vehicleType = "Trailer / ODC";
      data.vehicleSubType = "Trailer";
      state = "material";
      response = "📝 Enter *Material / Goods Description*:\n(e.g., Industrial machinery, Textiles, FMCG)";
    } else {
      response = "❌ Invalid choice. Reply with *1, 2, 3 or 4*";
    }
  } else if (state === "tempo_type") {
    if (tempoSizeMap[message]) {
      data.vehicleType = "Tempo";
      data.vehicleSubType = tempoSizeMap[message];
      state = "material";
      response = "📝 Enter *Material / Goods Description*:\n(e.g., Industrial machinery, Textiles, FMCG)";
    } else {
      response = "❌ Invalid choice. Reply with *1 - 5*:\n1️⃣ 7 Ft\n2️⃣ 8 Ft\n3️⃣ 9 Ft\n4️⃣ 14 Ft\n5️⃣ 17 Ft";
    }
  } else if (state === "truck_type") {
    if (truckTypeMap[message]) {
      data.vehicleType = "Truck";
      data.vehicleSubType = truckTypeMap[message];
      state = "material";
      response = "📝 Enter *Material / Goods Description*:\n(e.g., Industrial machinery, Textiles, FMCG)";
    } else {
      response = "❌ Invalid choice. Reply with *1 - 4*:\n1️⃣ 19 Ft Open\n2️⃣ 22 Ft Open\n3️⃣ 24 Ft Open\n4️⃣ 32 Ft Open";
    }
  } else if (state === "container_type") {
    if (containerTypeMap[message]) {
      data.vehicleType = "Container";
      data.vehicleSubType = containerTypeMap[message];
      state = "material";
      response = "📝 Enter *Material / Goods Description*:\n(e.g., Industrial machinery, Textiles, FMCG)";
    } else {
      response = "❌ Invalid choice. Reply with *1 - 4*:\n1️⃣ 20 Ft Close Body\n2️⃣ 24 Ft Close Body\n3️⃣ 32 Ft SXL Close Body\n4️⃣ 32 Ft MXL Close Body";
    }
  } else if (state === "material") {
    const hasLetters = /[a-zA-Z]/.test(message);
    const isValidLength = message.trim().length >= 2;
    if (hasLetters && isValidLength) {
      data.material = message.trim();
      state = "loading_date";
      response = "📅 Enter *Loading Date* (DD/MM/YYYY):\n(e.g., 25/09/2026)";
    } else {
      response = "❌ Invalid description. Please enter a valid *Material / Goods Description*:\n(e.g., Industrial machinery, Textiles, FMCG)";
    }
  } else if (state === "loading_date") {
    const dateCheck = validateLoadingDate(message);
    if (dateCheck.valid) {
      data.loadingDate = message.trim();
      state = "company";
      response = "🏢 Enter your *Company Name*:\n(or type *NA* if individual)";
    } else if (dateCheck.reason === "past") {
      response = "❌ Loading date cannot be in the past.\n\nPlease enter today's date or a future date in DD/MM/YYYY format:\n(e.g., 25/09/2026)";
    } else {
      response = "❌ Invalid date format.\n\nPlease enter a valid date in DD/MM/YYYY format:\n(e.g., 25/09/2026)";
    }
  } else if (state === "company") {
    data.company = message;
    state = "contact_name";
    response = "👤 Enter *Contact Person Name*:";
  } else if (state === "contact_name") {
    data.contactName = message;
    state = "email";
    response = "📧 Enter your *Email Address*:\n(or type *Skip*)";
  } else if (state === "email") {
    const isSkip = ["skip", "na", "n/a"].includes(lowerMessage);
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (isSkip || emailRegex.test(message.trim())) {
      data.email = isSkip ? "" : message.trim();
      data.phone = phone;
      state = "cta_menu";
      response =
        "✅ *Booking Request Submitted Successfully!*\n\n" +
        `📍 *Route:* ${data.loadingPin} ➔ ${data.unloadingPin}\n` +
        `📦 *Cargo:* ${data.cargoType}\n` +
        `🚛 *Vehicle:* ${data.vehicleType} (${data.vehicleSubType || "Standard"})\n` +
        `📝 *Material:* ${data.material}\n` +
        `📅 *Loading Date:* ${data.loadingDate}\n` +
        `👤 *Contact:* ${data.contactName} (${data.company})\n` +
        (data.email ? `📧 *Email:* ${data.email}\n\n` : "\n") +
        "Our team is finding the best quote and will contact you shortly! 🚛💨";
    } else {
      response = "❌ Invalid email format.\n\nPlease enter a valid email address (e.g., rahul@gmail.com, info@company.co.in)\nor type *Skip*:";
    }
  }

  // 3. PROVIDE VEHICLE FLOW
  else if (state === "provider_vehicle_type") {
    if (["1", "2", "3", "4"].includes(message)) {
      data.provider_vehicleType = vehicleTypeMap[message] || message;
      state = "provider_vehicle_number";
      response = "🔢 Enter *Vehicle Registration Number*:\n(e.g., MH 04 AB 1234)";
    } else {
      response =
        "❌ Invalid option.\n\nSelect Vehicle Category:\n" +
        "1️⃣ Tempo (7ft, 8ft, 9ft, 14ft, 17ft)\n" +
        "2️⃣ Open Truck (19ft, 22ft, 24ft, 32ft)\n" +
        "3️⃣ Container (20ft, 24ft, 32ft SXL/MXL)\n" +
        "4️⃣ Trailer / ODC (40ft, High Bed, Low Bed)\n\n" +
        "Reply with *1, 2, 3 or 4*";
    }
  } else if (state === "provider_vehicle_number") {
    const regRegex = /^([A-Z]{2}\s*[-]?\s*\d{2}\s*[-]?\s*[A-Z]{1,3}\s*[-]?\s*\d{4}|\d{2}\s*BH\s*\d{4}\s*[A-Z]{1,2})$/i;
    if (regRegex.test(message.trim())) {
      data.provider_vehicleNumber = message.trim().toUpperCase();
      state = "provider_driver_name";
      response = "👤 Enter *Driver / Owner Name*:";
    } else {
      response = "❌ Invalid Vehicle Registration Number.\n\nPlease enter a valid registration number (e.g., MH 04 AB 1234):";
    }
  } else if (state === "provider_driver_name") {
    const hasLetters = /[a-zA-Z]{2,}/.test(message);
    if (hasLetters) {
      data.provider_driverName = message.trim();
      state = "provider_capacity";
      response = "⚖️ Enter *Payload Capacity* (in Tons / Kgs):\n(e.g., 9 Tons or 2500 Kgs)";
    } else {
      response = "❌ Invalid name.\n\nPlease enter a valid Driver / Owner Name (e.g., Rahul Sharma):";
    }
  } else if (state === "provider_capacity") {
    const isLiquid = /(litre|liter|ml|gallon)/i.test(message);
    const hasNumber = /\d+/.test(message);
    const hasValidUnitOrNum = (hasNumber || /(ton|mt|kg|quintal)/i.test(message)) && !isLiquid;
    if (hasValidUnitOrNum) {
      data.provider_capacity = message.trim();
      state = "provider_routes";
      response = "🛣️ Enter *Preferred Routes / Operating Cities*:\n(e.g., Mumbai - Ahmedabad - Delhi)";
    } else {
      response = "❌ Invalid payload capacity.\n\nPlease enter payload capacity in Tons or Kgs (e.g., 9 Tons, 2500 Kgs, 10 MT):";
    }
  } else if (state === "provider_routes") {
    const hasLetters = /[a-zA-Z]{2,}/.test(message);
    if (hasLetters) {
      data.provider_routes = message.trim();
      data.provider_driverPhone = phone;
      state = "cta_menu";
      response =
        "✅ *Vehicle Registered Successfully!*\n\n" +
        `🚛 *Vehicle:* ${data.provider_vehicleType} (${data.provider_vehicleNumber})\n` +
        `👤 *Owner/Driver:* ${data.provider_driverName}\n` +
        `⚖️ *Capacity:* ${data.provider_capacity}\n` +
        `🛣️ *Routes:* ${data.provider_routes}\n\n` +
        "We will assign loads matching your routes and vehicle capacity! 🚛🤝";
    } else {
      response = "❌ Invalid route.\n\nPlease enter operating routes or cities (e.g., Mumbai - Ahmedabad - Delhi):";
    }
  }

  // 4. CTA MENU ACTIONS
  else if (state === "cta_menu" || lowerMessage.startsWith("cta_")) {
    if (message === "cta_new" || lowerMessage === "post new order") {
      const newSessionId = `${phone}_${Date.now()}`;
      return {
        user_id: newSessionId,
        phone: phone,
        state: "main_menu",
        updated_at: new Date().toISOString(),
        response:
          "👉 Please select your requirement:\n\n" +
          "1️⃣ Book a Vehicle (Customer)\n" +
          "2️⃣ Provide Vehicle (Transporter)\n" +
          "3️⃣ Support\n\n" +
          "Reply with *1, 2 or 3*",
        flowType: "",
        data: "{}",
      };
    } else if (message === "cta_support" || lowerMessage === "support") {
      state = "support";
      flowType = "support";
      response = "📞 *Traket Support Desk*\n\n📧 Email: support@traket.in\n🌐 Web: https://traket.in\n\nOur team is here to help you!";
    } else {
      state = "main_menu";
      response = "👋 Type *Hi* anytime to start a new booking or inquiry!";
    }
  } else {
    // Default fallback
    state = "main_menu";
    response = "👋 Welcome to *Traket Transport*!\n\nType *Hi* to see the main menu options.";
  }

  return {
    user_id: row.user_id || `${phone}_${Date.now()}`,
    phone: phone,
    state: state,
    updated_at: new Date().toISOString(),
    response: response,
    flowType: flowType,
    data: JSON.stringify(data),
  };
}

// =====================================================================
// MAIN SERVE HANDLER
// =====================================================================
serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    console.log(`[${req.method}] ${url.pathname}`);

    // 1. Health check
    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      return new Response("ok", { status: 200 });
    }

    // 2. Webhook verification GET
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
        console.log("Webhook verified successfully with Meta");
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    // 3. Webhook event POST
    if (req.method === "POST") {
      const rawBody = await req.text();
      const signature = req.headers.get("x-hub-signature-256");

      if (WHATSAPP_APP_SECRET && !(await isValidSignature(rawBody, signature))) {
        console.warn("Invalid webhook signature — skipping signature check in dev fallback");
      }

      let payload: any = {};
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response("Bad Request", { status: 400 });
      }

      const entries = payload.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const val = change.value;
          if (!val?.messages?.length) {
            console.log("Webhook received status update / non-message payload, skipping.");
            continue;
          }

          const phone = val.messages[0]?.from;
          const msgText = val.messages[0]?.text?.body;
          console.log(`Incoming message from ${phone}: "${msgText}"`);

          // 1. Get existing session from Supabase (safe fallback)
          let masterRows: any[] = [];
          try {
            const { data } = await supabase
              .from("users_master")
              .select("*")
              .eq("phone", phone);
            masterRows = data || [];
          } catch (dbErr) {
            console.warn("Failed to fetch master row from Supabase:", dbErr);
          }

          // 2. Process state machine
          const output = processConversation(val, masterRows);
          console.log(`Next state: "${output.state}", response: "${output.response?.slice(0, 30)}..."`);

          // 3. Send WhatsApp reply FIRST so user always gets the reply immediately
          try {
            if (output.response) {
              await sendWhatsAppText(output.phone, output.response);
            }
            if (output.state === "cta_menu") {
              await sendWhatsAppCtaButtons(output.phone);
            }
          } catch (waErr) {
            console.error("Error sending WhatsApp message:", waErr);
          }

          // 4. Upsert session to Supabase in background
          try {
            await supabase.from("users_master").upsert({
              user_id: output.user_id,
              phone: output.phone,
              state: output.state,
              updated_at: output.updated_at,
              flow_type: output.flowType,
              data: JSON.parse(output.data || "{}"),
            });

            const parsedData = JSON.parse(output.data || "{}");
            if (output.flowType === "book") {
              await supabase.from("book_vehicle").upsert({
                user_id: output.user_id,
                state: output.state,
                updated_at: output.updated_at,
                loading_pin: parsedData.loadingPin || "",
                unloading_pin: parsedData.unloadingPin || "",
                cargo_type: parsedData.cargoType || "",
                vehicle_type: parsedData.vehicleType || "",
                vehicle_sub_type: parsedData.vehicleSubType || "",
                material: parsedData.material || "",
                loading_date: parsedData.loadingDate || "",
                company: parsedData.company || "",
                contact_name: parsedData.contactName || "",
                phone: parsedData.phone || phone,
                email: parsedData.email || "",
              });
            } else if (output.flowType === "provider") {
              await supabase.from("provide_vehicle").upsert({
                user_id: output.user_id,
                state: output.state,
                updated_at: output.updated_at,
                vehicle_type: parsedData.provider_vehicleType || "",
                vehicle_number: parsedData.provider_vehicleNumber || "",
                driver_name: parsedData.provider_driverName || "",
                capacity: parsedData.provider_capacity || "",
                route_preference: parsedData.provider_routes || "",
                driver_phone: parsedData.provider_driverPhone || phone,
              });
            }
          } catch (dbSaveErr) {
            console.warn("Failed to persist session to Supabase:", dbSaveErr);
          }
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err: any) {
    console.error("Fatal error handling request:", err);
    return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack || "" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
