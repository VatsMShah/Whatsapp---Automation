import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const AUTH_JWT_SECRET = Deno.env.get("AUTH_JWT_SECRET") || "";
const WHATSAPP_ACCESS_TOKEN = (Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "").trim();
const WHATSAPP_PHONE_NUMBER_ID = (Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "").trim();
const GRAPH_API_VERSION = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") || "v20.0";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PBKDF2_ITERATIONS = 100_000;
const JWT_ISSUER = "traket-crm-auth";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-traket-token",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Edge Function environment.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// -------------------------------------------------------------------------
// Base64URL & Byte Helpers
// -------------------------------------------------------------------------
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return timingSafeEqualBytes(enc.encode(a), enc.encode(b));
}

// -------------------------------------------------------------------------
// Server-Side HMAC-SHA256 JWT Engine
// -------------------------------------------------------------------------
async function getJwtSigningKey(): Promise<CryptoKey> {
  const rawSecret = AUTH_JWT_SECRET || SUPABASE_SERVICE_ROLE_KEY;
  if (!rawSecret) {
    throw new Error("Server JWT signing secret is unavailable.");
  }
  // Derive a dedicated key domain-separated for CRM auth tokens
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`traket-jwt-v1:${rawSecret}`)
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

interface JwtClaims {
  sub: string;
  role: "admin" | "employee";
  employee_id?: string;
  username?: string;
  email?: string;
  name: string;
  iss: string;
  iat: number;
  exp: number;
}

async function signJwt(
  claims: Omit<JwtClaims, "iss" | "iat" | "exp">,
  expiresInSeconds: number
): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtClaims = {
    ...claims,
    iss: JWT_ISSUER,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const enc = new TextEncoder();
  const headerB64 = bytesToBase64Url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadB64 = bytesToBase64Url(enc.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getJwtSigningKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(signingInput)));
  const token = `${signingInput}.${bytesToBase64Url(sig)}`;
  return {
    token,
    expiresAt: new Date(fullPayload.exp * 1000).toISOString(),
  };
}

async function verifyJwt(token: string): Promise<JwtClaims | null> {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64)));
    if (header?.alg !== "HS256") return null;

    const key = await getJwtSigningKey();
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBytes = base64UrlToBytes(sigB64);

    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, signingInput);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as JwtClaims;
    if (payload.iss !== JWT_ISSUER) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (payload.role !== "admin" && payload.role !== "employee") return null;

    return payload;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------------
// Password Hashing & Verification (PBKDF2-SHA256 + pgcrypto bcrypt)
// -------------------------------------------------------------------------
async function hashPassword(plain: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derivedBits))}`;
}

async function verifyPbkdf2(plain: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  if (!iterations || iterations < 10_000) return false;

  const salt = hexToBytes(parts[2]);
  const expectedHash = hexToBytes(parts[3]);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    expectedHash.length * 8
  );

  return timingSafeEqualBytes(new Uint8Array(derivedBits), expectedHash);
}

async function verifyPassword(
  supabase: ReturnType<typeof createClient>,
  plain: string,
  storedHash?: string | null,
  legacyPlain?: string | null
): Promise<{ valid: boolean; upgradeNeeded: boolean }> {
  if (!plain || plain.trim() === "") {
    return { valid: false, upgradeNeeded: false };
  }

  const hash = (storedHash || "").trim();
  if (hash.startsWith("pbkdf2$")) {
    const ok = await verifyPbkdf2(plain, hash);
    return { valid: ok, upgradeNeeded: false };
  }

  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    const { data, error } = await supabase.rpc("auth_verify_bcrypt", {
      p_plain: plain,
      p_hash: hash,
    });
    if (error) {
      console.error("auth_verify_bcrypt RPC failed:", error.message);
      return { valid: false, upgradeNeeded: false };
    }
    return { valid: Boolean(data), upgradeNeeded: Boolean(data) };
  }

  // Legacy migration safety: if an unmigrated plaintext password exists, verify exact match and upgrade immediately
  const legacy = (legacyPlain || "").trim();
  if (legacy !== "") {
    const ok = timingSafeEqualStrings(plain, legacy);
    return { valid: ok, upgradeNeeded: ok };
  }

  return { valid: false, upgradeNeeded: false };
}

function validatePasswordStrength(password: string, minLength = 8): string | null {
  if (!password || password.length < minLength) {
    return `Password must be at least ${minLength} characters long.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) {
    return "Password must include at least one letter and one number or special symbol.";
  }
  return null;
}

// -------------------------------------------------------------------------
// Helpers: Sanitize, Audit, OTP & WhatsApp
// -------------------------------------------------------------------------
function sanitizeEmployee(emp: Record<string, any>, fullForAdmin = true) {
  const base = {
    id: emp.id || emp.employee_id,
    employee_id: emp.employee_id,
    name: emp.name,
    department: emp.department || "Sales",
    role: emp.role || "employee",
    is_active: Boolean(emp.is_active),
    assigned_vehicles: Array.isArray(emp.assigned_vehicles) ? emp.assigned_vehicles : [],
    assigned_subtypes: Array.isArray(emp.assigned_subtypes) ? emp.assigned_subtypes : [],
    created_at: emp.created_at || new Date().toISOString(),
  };

  if (!fullForAdmin) return base;

  return {
    ...base,
    email: emp.email || "",
    phone: emp.phone || "",
    has_password: Boolean(
      (emp.password_hash && String(emp.password_hash).trim() !== "") ||
      (emp.password && String(emp.password).trim() !== "")
    ),
    must_change_password: Boolean(emp.must_change_password),
    last_login_at: emp.last_login_at || null,
  };
}

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  actorType: "admin" | "employee",
  actorId: string | null,
  identifier: string,
  eventType: string,
  success: boolean,
  reason = ""
) {
  try {
    await supabase.from("auth_audit_logs").insert({
      actor_type: actorType,
      actor_id: actorId,
      identifier,
      event_type: eventType,
      success,
      reason,
    });
  } catch (err) {
    console.warn("Audit log write skipped:", (err as Error).message);
  }
}

async function hashOtp(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function sendWhatsAppOtp(phone: string, name: string, otp: string, accountLabel: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { sent: false, error: "WhatsApp API credentials not configured on server." };
  }
  const digits = phone.replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  if (to.length < 10) {
    return { sent: false, error: "Invalid phone number format." };
  }

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
      type: "text",
      text: {
        body:
          `🔐 *Traket CRM Password Reset Code*\n\n` +
          `Hello ${name || "Team Member"},\n` +
          `Your verification code for *${accountLabel}* is:\n\n` +
          `*${otp}*\n\n` +
          `⏳ Valid for *10 minutes*. Never share this code with anyone.`,
      },
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    return { sent: false, error: errData?.error?.message || `WhatsApp API error ${res.status}` };
  }
  return { sent: true };
}

function extractToken(req: Request, body: Record<string, any>): string {
  const customHeader = req.headers.get("x-traket-token") || "";
  if (customHeader.trim()) return customHeader.trim();

  if (typeof body?.token === "string" && body.token.trim()) {
    return body.token.trim();
  }

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
}

async function authenticateRequest(
  req: Request,
  body: Record<string, any>,
  supabase: ReturnType<typeof createClient>
): Promise<{ claims: JwtClaims; user: Record<string, any> } | null> {
  const token = extractToken(req, body);
  if (!token) return null;

  const claims = await verifyJwt(token);
  if (!claims) return null;

  if (claims.role === "admin") {
    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("id, username, email, name, phone, role, is_active, must_change_password")
      .eq("id", claims.sub)
      .maybeSingle();

    if (error || !admin || !admin.is_active) return null;
    return {
      claims,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        phone: admin.phone || "",
        role: "admin",
        must_change_password: Boolean(admin.must_change_password),
      },
    };
  }

  const { data: emp, error } = await supabase
    .from("employees")
    .select("*")
    .eq("employee_id", claims.employee_id || claims.sub)
    .maybeSingle();

  if (error || !emp || !emp.is_active) return null;
  return {
    claims,
    user: sanitizeEmployee(emp, true),
  };
}

async function findAdminByIdentifier(
  supabase: ReturnType<typeof createClient>,
  identifier: string
) {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return { data: null, error: null };

  const byEmail = await supabase
    .from("admin_users")
    .select("*")
    .ilike("email", clean)
    .limit(1)
    .maybeSingle();

  if (byEmail.error || byEmail.data) return byEmail;

  return supabase
    .from("admin_users")
    .select("*")
    .ilike("username", clean)
    .limit(1)
    .maybeSingle();
}

async function findEmployeeByIdentifier(
  supabase: ReturnType<typeof createClient>,
  identifier: string
) {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return { data: null, error: null };

  const byId = await supabase
    .from("employees")
    .select("*")
    .ilike("employee_id", clean)
    .limit(1)
    .maybeSingle();

  if (byId.error || byId.data) return byId;

  return supabase
    .from("employees")
    .select("*")
    .ilike("email", clean)
    .limit(1)
    .maybeSingle();
}

// -------------------------------------------------------------------------
// Main Request Handler
// -------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const startMs = Date.now();

  try {
    const supabase = getServiceClient();

    if (req.method === "GET") {
      const { error } = await supabase.from("employees").select("employee_id", { count: "exact", head: true });
      return jsonResponse({
        ok: !error,
        service: "traket-auth",
        latencyMs: Date.now() - startMs,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    // 1. HEALTH CHECK
    if (action === "health") {
      const { error } = await supabase.from("employees").select("employee_id", { count: "exact", head: true });
      return jsonResponse({
        ok: !error,
        latencyMs: Date.now() - startMs,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. ADMIN LOGIN
    if (action === "login_admin") {
      const identifier = String(body.identifier || "").trim().toLowerCase();
      const password = String(body.password || "");
      const rememberMe = Boolean(body.rememberMe);

      if (!identifier || !password.trim()) {
        return jsonResponse({ success: false, error: "Please enter both Admin email/username and password." }, 400);
      }

      const { data: admin, error: queryErr } = await findAdminByIdentifier(supabase, identifier);

      if (queryErr) {
        if (queryErr.message?.includes("admin_users") || queryErr.code === "42P01") {
          return jsonResponse(
            {
              success: false,
              error: "Database security migration is pending. Please run supabase/auth_jwt_security.sql in Supabase SQL Editor.",
            },
            503
          );
        }
        return jsonResponse({ success: false, error: "Authentication service error." }, 500);
      }

      if (!admin) {
        await logAudit(supabase, "admin", null, identifier, "login_failed", false, "user_not_found");
        return jsonResponse({ success: false, error: "Invalid administrator email/username or password." }, 401);
      }

      if (!admin.is_active) {
        await logAudit(supabase, "admin", admin.id, identifier, "login_failed", false, "account_disabled");
        return jsonResponse({ success: false, error: "This administrator account is currently deactivated." }, 403);
      }

      if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
        const minsLeft = Math.ceil((new Date(admin.locked_until).getTime() - Date.now()) / 60000);
        return jsonResponse(
          {
            success: false,
            error: `Too many failed sign-in attempts. Account temporarily locked for ${minsLeft} minute(s).`,
          },
          429
        );
      }

      const { valid, upgradeNeeded } = await verifyPassword(supabase, password, admin.password_hash);
      if (!valid) {
        const nextAttempts = (admin.failed_attempts || 0) + 1;
        const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
        const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;

        await supabase
          .from("admin_users")
          .update({
            failed_attempts: nextAttempts,
            locked_until: lockedUntil,
            updated_at: new Date().toISOString(),
          })
          .eq("id", admin.id);

        await logAudit(
          supabase,
          "admin",
          admin.id,
          identifier,
          shouldLock ? "account_locked" : "login_failed",
          false,
          `attempt_${nextAttempts}`
        );

        const remaining = MAX_FAILED_ATTEMPTS - nextAttempts;
        return jsonResponse(
          {
            success: false,
            error: shouldLock
              ? `Account locked for ${LOCKOUT_MINUTES} minutes due to repeated failed attempts.`
              : `Invalid administrator credentials. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout)`,
          },
          shouldLock ? 429 : 401
        );
      }

      const updateFields: Record<string, any> = {
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (upgradeNeeded) {
        updateFields.password_hash = await hashPassword(password);
      }
      await supabase.from("admin_users").update(updateFields).eq("id", admin.id);
      await logAudit(supabase, "admin", admin.id, identifier, "login_success", true);

      const ttl = rememberMe ? 7 * 24 * 60 * 60 : 12 * 60 * 60;
      const { token, expiresAt } = await signJwt(
        {
          sub: admin.id,
          role: "admin",
          username: admin.username,
          email: admin.email,
          name: admin.name,
        },
        ttl
      );

      return jsonResponse({
        success: true,
        token,
        expiresAt,
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          name: admin.name,
          phone: admin.phone || "",
          role: "admin",
          must_change_password: Boolean(admin.must_change_password),
        },
      });
    }

    // 3. EMPLOYEE LOGIN (Strict: unique employee_id or email ONLY, mandatory password)
    if (action === "login_employee") {
      const identifier = String(body.identifier || "").trim();
      const password = String(body.password || "");
      const rememberMe = Boolean(body.rememberMe);

      if (!identifier || !password.trim()) {
        return jsonResponse({ success: false, error: "Please enter both your Employee ID/Email and password." }, 400);
      }

      const cleanLower = identifier.toLowerCase();
      const { data: emp, error: queryErr } = await findEmployeeByIdentifier(supabase, identifier);

      if (queryErr) {
        return jsonResponse({ success: false, error: "Unable to verify employee credentials." }, 500);
      }

      if (!emp) {
        await logAudit(supabase, "employee", null, cleanLower, "login_failed", false, "user_not_found");
        return jsonResponse({ success: false, error: "Invalid Employee ID/Email or password." }, 401);
      }

      if (!emp.is_active) {
        await logAudit(supabase, "employee", emp.employee_id, cleanLower, "login_failed", false, "account_deactivated");
        return jsonResponse(
          {
            success: false,
            error: `Account for ${emp.name} (${emp.employee_id}) is deactivated. Contact your Traket Admin.`,
          },
          403
        );
      }

      if (emp.locked_until && new Date(emp.locked_until).getTime() > Date.now()) {
        const minsLeft = Math.ceil((new Date(emp.locked_until).getTime() - Date.now()) / 60000);
        return jsonResponse(
          {
            success: false,
            error: `Account temporarily locked due to repeated failed attempts. Try again in ${minsLeft} minute(s).`,
          },
          429
        );
      }

      // Fail closed if no password configured
      const hasCredential = Boolean(
        (emp.password_hash && String(emp.password_hash).trim()) ||
        (emp.password && String(emp.password).trim())
      );
      if (!hasCredential) {
        await logAudit(supabase, "employee", emp.employee_id, cleanLower, "login_failed", false, "no_password_configured");
        return jsonResponse(
          {
            success: false,
            error: "No access password is set for this account yet. Ask your Admin to set one or reset via WhatsApp OTP.",
          },
          403
        );
      }

      const { valid, upgradeNeeded } = await verifyPassword(
        supabase,
        password,
        emp.password_hash,
        emp.password
      );

      if (!valid) {
        const nextAttempts = (emp.failed_attempts || 0) + 1;
        const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
        const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;

        await supabase
          .from("employees")
          .update({
            failed_attempts: nextAttempts,
            locked_until: lockedUntil,
            updated_at: new Date().toISOString(),
          })
          .eq("employee_id", emp.employee_id);

        await logAudit(
          supabase,
          "employee",
          emp.employee_id,
          cleanLower,
          shouldLock ? "account_locked" : "login_failed",
          false,
          `attempt_${nextAttempts}`
        );

        const remaining = MAX_FAILED_ATTEMPTS - nextAttempts;
        return jsonResponse(
          {
            success: false,
            error: shouldLock
              ? `Account locked for ${LOCKOUT_MINUTES} minutes due to repeated failed attempts.`
              : `Invalid Employee ID/Email or password. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
          },
          shouldLock ? 429 : 401
        );
      }

      const updateFields: Record<string, any> = {
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (upgradeNeeded) {
        updateFields.password_hash = await hashPassword(password);
        updateFields.password = null;
      }
      await supabase.from("employees").update(updateFields).eq("employee_id", emp.employee_id);
      await logAudit(supabase, "employee", emp.employee_id, cleanLower, "login_success", true);

      const ttl = rememberMe ? 7 * 24 * 60 * 60 : 12 * 60 * 60;
      const { token, expiresAt } = await signJwt(
        {
          sub: emp.employee_id,
          role: "employee",
          employee_id: emp.employee_id,
          email: emp.email || "",
          name: emp.name,
        },
        ttl
      );

      return jsonResponse({
        success: true,
        token,
        expiresAt,
        user: sanitizeEmployee(emp, true),
      });
    }

    // 4. VERIFY SESSION JWT
    if (action === "verify_session") {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth) {
        return jsonResponse({ valid: false, error: "Session expired or invalid." }, 401);
      }
      return jsonResponse({
        valid: true,
        role: auth.claims.role,
        user: auth.user,
      });
    }

    // 5. CHANGE PASSWORD (Authenticated User)
    if (action === "change_password") {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth) {
        return jsonResponse({ success: false, error: "Authentication required." }, 401);
      }

      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");

      const strengthErr = validatePasswordStrength(newPassword, 8);
      if (strengthErr) {
        return jsonResponse({ success: false, error: strengthErr }, 400);
      }

      if (auth.claims.role === "admin") {
        const { data: admin } = await supabase
          .from("admin_users")
          .select("*")
          .eq("id", auth.claims.sub)
          .single();
        if (!admin) return jsonResponse({ success: false, error: "Account not found." }, 404);

        const { valid } = await verifyPassword(supabase, currentPassword, admin.password_hash);
        if (!valid) {
          return jsonResponse({ success: false, error: "Current password is incorrect." }, 401);
        }

        const newHash = await hashPassword(newPassword);
        await supabase
          .from("admin_users")
          .update({
            password_hash: newHash,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", admin.id);

        await logAudit(supabase, "admin", admin.id, admin.email, "password_changed", true);
        return jsonResponse({ success: true });
      } else {
        const { data: emp } = await supabase
          .from("employees")
          .select("*")
          .eq("employee_id", auth.claims.employee_id || auth.claims.sub)
          .single();
        if (!emp) return jsonResponse({ success: false, error: "Employee account not found." }, 404);

        const { valid } = await verifyPassword(supabase, currentPassword, emp.password_hash, emp.password);
        if (!valid) {
          return jsonResponse({ success: false, error: "Current password is incorrect." }, 401);
        }

        const newHash = await hashPassword(newPassword);
        await supabase
          .from("employees")
          .update({
            password_hash: newHash,
            password: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq("employee_id", emp.employee_id);

        await logAudit(supabase, "employee", emp.employee_id, emp.employee_id, "password_changed", true);
        return jsonResponse({ success: true });
      }
    }

    // 6. REQUEST PASSWORD RESET (WhatsApp OTP)
    if (action === "request_password_reset") {
      const portal = body.portal === "admin" ? "admin" : "employee";
      const identifier = String(body.identifier || "").trim().toLowerCase();
      if (!identifier) {
        return jsonResponse({ success: false, error: "Please enter your Employee ID or Email." }, 400);
      }

      const genericOk = {
        success: true,
        message: "If an active account has a registered WhatsApp number, a 6-digit reset code has been sent.",
      };

      let actorId = "";
      let phone = "";
      let displayName = "";
      let accountLabel = "";

      if (portal === "admin") {
        const { data: admin } = await findAdminByIdentifier(supabase, identifier);
        if (!admin || !admin.is_active || !admin.phone) {
          return jsonResponse(genericOk);
        }
        actorId = admin.id;
        phone = admin.phone;
        displayName = admin.name;
        accountLabel = admin.email;
      } else {
        const { data: emp } = await findEmployeeByIdentifier(supabase, identifier);
        if (!emp || !emp.is_active || !emp.phone) {
          return jsonResponse(genericOk);
        }
        actorId = emp.employee_id;
        phone = emp.phone;
        displayName = emp.name;
        accountLabel = emp.employee_id;
      }

      // Generate cryptographically random 6-digit OTP
      const rand = new Uint32Array(1);
      crypto.getRandomValues(rand);
      const otp = String(100000 + (rand[0] % 900000));
      const tokenHash = await hashOtp(`${portal}:${actorId}:${otp}`);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from("password_reset_tokens").insert({
        actor_type: portal,
        actor_id: actorId,
        identifier,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      await sendWhatsAppOtp(phone, displayName, otp, accountLabel);
      await logAudit(supabase, portal, actorId, identifier, "password_reset_requested", true);
      return jsonResponse(genericOk);
    }

    // 7. CONFIRM PASSWORD RESET (Verify OTP + Set New Password)
    if (action === "confirm_password_reset") {
      const portal = body.portal === "admin" ? "admin" : "employee";
      const identifier = String(body.identifier || "").trim().toLowerCase();
      const otp = String(body.otp || "").trim();
      const newPassword = String(body.newPassword || "");

      if (!identifier || !otp) {
        return jsonResponse({ success: false, error: "Identifier and 6-digit OTP code are required." }, 400);
      }

      const strengthErr = validatePasswordStrength(newPassword, 8);
      if (strengthErr) {
        return jsonResponse({ success: false, error: strengthErr }, 400);
      }

      let actorId = "";
      if (portal === "admin") {
        const { data: admin } = await findAdminByIdentifier(supabase, identifier);
        if (admin && admin.is_active) actorId = admin.id;
      } else {
        const { data: emp } = await findEmployeeByIdentifier(supabase, identifier);
        if (emp && emp.is_active) actorId = emp.employee_id;
      }

      if (!actorId) {
        return jsonResponse({ success: false, error: "Invalid or expired reset code." }, 400);
      }

      const { data: tokenRow } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("actor_type", portal)
        .eq("actor_id", actorId)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenRow || new Date(tokenRow.expires_at).getTime() <= Date.now() || tokenRow.attempts >= 5) {
        return jsonResponse({ success: false, error: "Reset code has expired or exceeded attempts. Request a new one." }, 400);
      }

      const candidateHash = await hashOtp(`${portal}:${actorId}:${otp}`);
      if (!timingSafeEqualStrings(candidateHash, tokenRow.token_hash)) {
        await supabase
          .from("password_reset_tokens")
          .update({ attempts: (tokenRow.attempts || 0) + 1 })
          .eq("id", tokenRow.id);
        return jsonResponse({ success: false, error: "Incorrect verification code." }, 400);
      }

      const newHash = await hashPassword(newPassword);
      if (portal === "admin") {
        await supabase
          .from("admin_users")
          .update({
            password_hash: newHash,
            failed_attempts: 0,
            locked_until: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", actorId);
      } else {
        await supabase
          .from("employees")
          .update({
            password_hash: newHash,
            password: null,
            failed_attempts: 0,
            locked_until: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq("employee_id", actorId);
      }

      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      await logAudit(supabase, portal, actorId, identifier, "password_reset_completed", true);
      return jsonResponse({ success: true, message: "Password updated! You can now sign in with your new password." });
    }

    // 8. LIST EMPLOYEES (Requires Valid JWT; never returns passwords/hashes)
    if (action === "get_employees") {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth) {
        return jsonResponse({ error: "Authentication required." }, 401);
      }

      const isAdmin = auth.claims.role === "admin";
      let query = supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: true });

      if (!isAdmin) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      const employees = (data || []).map((row: Record<string, any>) => sanitizeEmployee(row, isAdmin));
      return jsonResponse({ success: true, employees });
    }

    // 9. UPSERT EMPLOYEE (Admin Only — hashes password server-side)
    if (action === "upsert_employee") {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth || auth.claims.role !== "admin") {
        return jsonResponse({ error: "Administrator privileges required." }, 403);
      }

      const emp = body.employee || {};
      const employeeId = String(emp.employee_id || "").trim();
      const name = String(emp.name || "").trim();
      const rawPassword = String(emp.password || "").trim();

      if (!employeeId || !name) {
        return jsonResponse({ error: "Employee ID and Name are required." }, 400);
      }

      const { data: existing } = await supabase
        .from("employees")
        .select("employee_id, password_hash, password")
        .eq("employee_id", employeeId)
        .maybeSingle();

      const hasExistingPass = Boolean(existing?.password_hash || existing?.password);
      if (!existing && !rawPassword) {
        return jsonResponse({ error: "A password of at least 6 characters is required for new employees." }, 400);
      }
      if (rawPassword && rawPassword.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters long." }, 400);
      }

      const payload: Record<string, any> = {
        employee_id: employeeId,
        name,
        email: String(emp.email || "").trim(),
        phone: String(emp.phone || "").trim(),
        department: String(emp.department || "Sales"),
        role: emp.role === "admin" ? "admin" : "employee",
        is_active: emp.is_active !== undefined ? Boolean(emp.is_active) : true,
        assigned_vehicles: Array.isArray(emp.assigned_vehicles) ? emp.assigned_vehicles : [],
        assigned_subtypes: Array.isArray(emp.assigned_subtypes) ? emp.assigned_subtypes : [],
        updated_at: new Date().toISOString(),
      };

      if (rawPassword) {
        payload.password_hash = await hashPassword(rawPassword);
        payload.password = null;
        payload.failed_attempts = 0;
        payload.locked_until = null;
      } else if (!hasExistingPass) {
        return jsonResponse({ error: "Please set a password for this employee account." }, 400);
      }

      let { data, error } = await supabase
        .from("employees")
        .upsert(payload, { onConflict: "employee_id" })
        .select("*")
        .single();

      if (error && (error.message?.includes("assigned_vehicles") || error.message?.includes("assigned_subtypes"))) {
        const { assigned_vehicles: _av, assigned_subtypes: _as, ...rest } = payload;
        const retry = await supabase
          .from("employees")
          .upsert(rest, { onConflict: "employee_id" })
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error || !data) {
        const msg = error?.message || "Failed to save employee.";
        if (msg.includes("password_hash") || msg.includes("failed_attempts")) {
          return jsonResponse({
            error: "Database security migration pending: please run supabase/auth_jwt_security.sql in Supabase SQL Editor first."
          }, 500);
        }
        return jsonResponse({ error: msg }, 500);
      }

      return jsonResponse({
        success: true,
        employee: sanitizeEmployee(
          {
            ...data,
            assigned_vehicles: payload.assigned_vehicles,
            assigned_subtypes: payload.assigned_subtypes,
          },
          true
        ),
      });
    }

    // 10. DEACTIVATE EMPLOYEE (Admin Only)
    if (action === "deactivate_employee") {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth || auth.claims.role !== "admin") {
        return jsonResponse({ error: "Administrator privileges required." }, 403);
      }

      const employeeId = String(body.employeeId || "").trim();
      if (!employeeId) {
        return jsonResponse({ error: "Missing employeeId." }, 400);
      }

      const { error } = await supabase
        .from("employees")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("employee_id", employeeId);

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `Unknown auth action: ${action}` }, 400);
  } catch (err) {
    console.error("Auth Edge Function error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
