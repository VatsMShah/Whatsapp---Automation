const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PBKDF2_ITERATIONS = 100_000;
const JWT_ISSUER = 'traket-crm-auth';

let serviceClient = null;
let cachedServiceRoleKey = '';

function getServiceClient() {
  const url = (config.supabase.url || '').replace(/\/rest\/v1\/?$/, '').trim();
  const serviceKey = (config.supabase.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceKey || serviceKey.startsWith('your_')) {
    return null;
  }

  if (!serviceClient || cachedServiceRoleKey !== serviceKey) {
    serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedServiceRoleKey = serviceKey;
  }
  return serviceClient;
}

// -------------------------------------------------------------------------
// Base64URL & JWT Engine (HS256 via Node built-in crypto)
// -------------------------------------------------------------------------
function toBase64Url(bufOrStr) {
  const buf = Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(String(bufOrStr), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function getJwtSecretKey() {
  const raw =
    config.auth?.jwtSecret ||
    config.supabase.serviceRoleKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  if (!raw) return null;
  return crypto.createHash('sha256').update(`traket-jwt-v1:${raw}`).digest();
}

function signJwt(claims, expiresInSeconds) {
  const key = getJwtSecretKey();
  if (!key) {
    throw new Error('Server JWT signing secret is unavailable.');
  }
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...claims,
    iss: JWT_ISSUER,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerB64 = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = toBase64Url(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', key).update(signingInput).digest();
  return {
    token: `${signingInput}.${toBase64Url(sig)}`,
    expiresAt: new Date(fullPayload.exp * 1000).toISOString(),
  };
}

function verifyJwt(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(fromBase64Url(headerB64).toString('utf8'));
    if (header?.alg !== 'HS256') return null;

    const key = getJwtSecretKey();
    if (!key) return null;

    const expectedSig = crypto.createHmac('sha256', key).update(`${headerB64}.${payloadB64}`).digest();
    const actualSig = fromBase64Url(sigB64);
    if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(payloadB64).toString('utf8'));
    if (payload.iss !== JWT_ISSUER) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (payload.role !== 'admin' && payload.role !== 'employee') return null;
    return payload;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------------
// Password Hashing & Verification (PBKDF2-SHA256 + pgcrypto bcrypt RPC)
// -------------------------------------------------------------------------
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(plain, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPbkdf2(plain, storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  if (!iterations || iterations < 10_000) return false;

  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  const derived = crypto.pbkdf2Sync(plain, salt, iterations, expected.length, 'sha256');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

async function verifyPassword(supabase, plain, storedHash, legacyPlain) {
  if (!plain || String(plain).trim() === '') {
    return { valid: false, upgradeNeeded: false };
  }

  const hash = String(storedHash || '').trim();
  if (hash.startsWith('pbkdf2$')) {
    return { valid: verifyPbkdf2(plain, hash), upgradeNeeded: false };
  }

  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    const { data, error } = await supabase.rpc('auth_verify_bcrypt', {
      p_plain: plain,
      p_hash: hash,
    });
    if (error) {
      logger.error('auth_verify_bcrypt RPC failed', error);
      return { valid: false, upgradeNeeded: false };
    }
    return { valid: Boolean(data), upgradeNeeded: Boolean(data) };
  }

  if (legacyPlain && String(legacyPlain).trim() !== '') {
    const a = Buffer.from(plain, 'utf8');
    const b = Buffer.from(String(legacyPlain), 'utf8');
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { valid: match, upgradeNeeded: match };
  }

  return { valid: false, upgradeNeeded: false };
}

function validatePasswordStrength(password) {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (password.length > 128) {
    return 'Password must not exceed 128 characters.';
  }
  return null;
}

// -------------------------------------------------------------------------
// Sanitizers & Helpers
// -------------------------------------------------------------------------
function sanitizeEmployee(row, includeSelfFlags = false) {
  const clean = {
    id: row.id || row.employee_id,
    employee_id: row.employee_id,
    name: row.name,
    email: row.email || '',
    phone: row.phone || '',
    department: row.department || 'Sales',
    role: row.role || 'employee',
    is_active: Boolean(row.is_active),
    created_at: row.created_at || new Date().toISOString(),
    assigned_vehicles: Array.isArray(row.assigned_vehicles) ? row.assigned_vehicles : [],
    assigned_subtypes: Array.isArray(row.assigned_subtypes) ? row.assigned_subtypes : [],
    has_password: Boolean(
      (row.password_hash && String(row.password_hash).trim() !== '') ||
        (row.password && String(row.password).trim() !== '')
    ),
  };
  if (includeSelfFlags) {
    clean.must_change_password = Boolean(row.must_change_password);
  }
  return clean;
}

function extractJwtToken(req, body) {
  const customHeader = req.header('x-traket-token');
  if (customHeader && customHeader.trim()) return customHeader.trim();
  if (typeof body?.token === 'string' && body.token.trim()) return body.token.trim();
  return null;
}

async function authenticateRequest(req, body, supabase) {
  const token = extractJwtToken(req, body);
  if (!token) return null;

  const claims = verifyJwt(token);
  if (!claims) return null;

  if (claims.role === 'admin') {
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, username, email, name, phone, role, is_active, must_change_password')
      .eq('id', claims.sub)
      .maybeSingle();

    if (!admin || !admin.is_active) return null;
    return { claims, user: { ...admin, role: 'admin' } };
  }

  const { data: emp } = await supabase
    .from('employees')
    .select('*')
    .eq('employee_id', claims.employee_id || claims.sub)
    .maybeSingle();

  if (!emp || !emp.is_active) return null;
  return { claims, user: sanitizeEmployee(emp, true) };
}

async function logAudit(supabase, actorType, actorId, identifier, eventType, success, reason) {
  try {
    await supabase.from('auth_audit_logs').insert({
      actor_type: actorType,
      actor_id: actorId || null,
      identifier: identifier || null,
      event_type: eventType,
      success,
      reason: reason || null,
    });
  } catch (err) {
    logger.warn('Failed to write auth audit log', err?.message || err);
  }
}

async function findAdminByIdentifier(supabase, identifier) {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean) return { data: null, error: null };

  const byEmail = await supabase
    .from('admin_users')
    .select('*')
    .ilike('email', clean)
    .limit(1)
    .maybeSingle();

  if (byEmail.error || byEmail.data) return byEmail;

  return supabase
    .from('admin_users')
    .select('*')
    .ilike('username', clean)
    .limit(1)
    .maybeSingle();
}

async function findEmployeeByIdentifier(supabase, identifier) {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean) return { data: null, error: null };

  const byId = await supabase
    .from('employees')
    .select('*')
    .ilike('employee_id', clean)
    .limit(1)
    .maybeSingle();

  if (byId.error || byId.data) return byId;

  const byEmail = await supabase
    .from('employees')
    .select('*')
    .ilike('email', clean)
    .limit(1)
    .maybeSingle();

  if (byEmail.error || byEmail.data) return byEmail;

  // Also support employee login / password reset by registered mobile phone number
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 10) {
    const short10 = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    const byPhone = await supabase
      .from('employees')
      .select('*')
      .or(`phone.eq.${digits},phone.eq.${short10},phone.ilike.%${short10}%`)
      .limit(1)
      .maybeSingle();

    if (byPhone.data) return byPhone;
  }

  return { data: null, error: null };
}

async function sendWhatsAppResetOtp(phone, name, otp) {
  const token = (config.whatsapp.accessToken || '').trim();
  const phoneNumberId = (config.whatsapp.phoneNumberId || '').trim();
  const version = config.whatsapp.graphApiVersion || 'v20.0';

  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp credentials not configured on local server.' };
  }

  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 10) return { ok: false, error: 'Invalid phone number.' };

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'text',
        text: {
          body: `🔐 *Traket CRM Password Reset*\n\nHi ${name || 'Team Member'},\nYour 6-digit verification code is: *${otp}*\n\nThis code expires in 10 minutes. Never share it with anyone.`,
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: txt };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// -------------------------------------------------------------------------
// Express Handler (/api/auth)
// -------------------------------------------------------------------------
async function handleAuthRequest(req, res) {
  try {
    const body = req.body || {};
    const action = String(body.action || req.query?.action || '').trim();

    if (!action) {
      return res.status(400).json({ error: 'Missing auth action.' });
    }

    const supabase = getServiceClient();

    // 1. HEALTH CHECK
    if (action === 'health') {
      return res.json({
        ok: true,
        mode: 'local-express',
        configured: Boolean(supabase),
        status: supabase ? 'online' : 'missing_service_role_key',
        timestamp: new Date().toISOString(),
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error:
          'Local backend needs SUPABASE_SERVICE_ROLE_KEY in your root .env file to verify hashed logins. Copy your service_role key from Supabase Dashboard -> Project Settings -> API into .env and save.',
      });
    }

    // 2. ADMIN LOGIN
    if (action === 'login_admin') {
      const identifier = String(body.identifier || '').trim().toLowerCase();
      const password = String(body.password || '');
      const rememberMe = Boolean(body.rememberMe);

      if (!identifier || !password) {
        return res
          .status(400)
          .json({ success: false, error: 'Please enter both Admin email/username and password.' });
      }

      const { data: admin, error: queryErr } = await findAdminByIdentifier(supabase, identifier);
      if (queryErr) {
        const msg = queryErr.message || '';
        if (msg.includes('admin_users')) {
          return res.status(500).json({
            success: false,
            error: 'Authentication tables not initialized. Run supabase/auth_jwt_security.sql in Supabase SQL Editor.',
          });
        }
        return res.status(500).json({ success: false, error: 'Authentication service error.' });
      }

      if (!admin) {
        await logAudit(supabase, 'admin', null, identifier, 'login_failed', false, 'user_not_found');
        return res.status(401).json({ success: false, error: 'Invalid administrator email/username or password.' });
      }

      if (!admin.is_active) {
        await logAudit(supabase, 'admin', admin.id, identifier, 'login_failed', false, 'account_disabled');
        return res.status(403).json({ success: false, error: 'This administrator account is currently deactivated.' });
      }

      if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
        const minsLeft = Math.max(1, Math.ceil((new Date(admin.locked_until).getTime() - Date.now()) / 60000));
        await logAudit(supabase, 'admin', admin.id, identifier, 'account_locked', false, 'locked_out');
        return res.status(429).json({
          success: false,
          error: `Too many failed attempts. Account temporarily locked for ${minsLeft} minute(s).`,
        });
      }

      const { valid, upgradeNeeded } = await verifyPassword(supabase, password, admin.password_hash);
      if (!valid) {
        const nextAttempts = (admin.failed_attempts || 0) + 1;
        const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
        const lockUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;

        await supabase
          .from('admin_users')
          .update({
            failed_attempts: nextAttempts,
            locked_until: lockUntil,
            updated_at: new Date().toISOString(),
          })
          .eq('id', admin.id);

        await logAudit(
          supabase,
          'admin',
          admin.id,
          identifier,
          shouldLock ? 'account_locked' : 'login_failed',
          false,
          shouldLock ? 'max_attempts_exceeded' : 'invalid_password'
        );

        return res.status(shouldLock ? 429 : 401).json({
          success: false,
          error: shouldLock
            ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
            : `Invalid password. ${MAX_FAILED_ATTEMPTS - nextAttempts} attempt(s) remaining before temporary lockout.`,
        });
      }

      const updateFields = {
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (upgradeNeeded) {
        updateFields.password_hash = hashPassword(password);
      }
      await supabase.from('admin_users').update(updateFields).eq('id', admin.id);
      await logAudit(supabase, 'admin', admin.id, identifier, 'login_success', true);

      const ttl = rememberMe ? 7 * 24 * 3600 : 24 * 3600;
      const { token, expiresAt } = signJwt(
        {
          sub: admin.id,
          role: 'admin',
          username: admin.username,
          email: admin.email,
          name: admin.name,
        },
        ttl
      );

      return res.json({
        success: true,
        token,
        expiresAt,
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          name: admin.name,
          phone: admin.phone || '',
          role: 'admin',
          must_change_password: Boolean(admin.must_change_password),
        },
      });
    }

    // 3. EMPLOYEE LOGIN
    if (action === 'login_employee') {
      const identifier = String(body.identifier || '').trim();
      const password = String(body.password || '');
      const rememberMe = Boolean(body.rememberMe);

      if (!identifier || !password) {
        return res
          .status(400)
          .json({ success: false, error: 'Please enter both your Employee ID/Email and password.' });
      }

      const cleanLower = identifier.toLowerCase();
      const { data: emp, error: queryErr } = await findEmployeeByIdentifier(supabase, identifier);

      if (queryErr) {
        return res.status(500).json({ success: false, error: 'Unable to verify employee credentials.' });
      }

      if (!emp) {
        await logAudit(supabase, 'employee', null, cleanLower, 'login_failed', false, 'user_not_found');
        return res.status(401).json({ success: false, error: 'Invalid Employee ID/Email or password.' });
      }

      if (!emp.is_active) {
        await logAudit(supabase, 'employee', emp.employee_id, cleanLower, 'login_failed', false, 'account_deactivated');
        return res.status(403).json({
          success: false,
          error: `Account for ${emp.name} (${emp.employee_id}) is deactivated. Contact your Traket Admin.`,
        });
      }

      if (emp.locked_until && new Date(emp.locked_until).getTime() > Date.now()) {
        const minsLeft = Math.max(1, Math.ceil((new Date(emp.locked_until).getTime() - Date.now()) / 60000));
        await logAudit(supabase, 'employee', emp.employee_id, cleanLower, 'account_locked', false, 'locked_out');
        return res.status(429).json({
          success: false,
          error: `Account temporarily locked due to multiple failed attempts. Try again in ${minsLeft} minute(s) or contact Admin.`,
        });
      }

      const hasPasswordConfigured = Boolean(
        (emp.password_hash && String(emp.password_hash).trim() !== '') ||
          (emp.password && String(emp.password).trim() !== '')
      );
      if (!hasPasswordConfigured) {
        await logAudit(supabase, 'employee', emp.employee_id, cleanLower, 'login_failed', false, 'no_password_configured');
        return res.status(403).json({
          success: false,
          error: 'No login password has been assigned to this account yet. Ask your Traket Admin to set one in Team Management.',
        });
      }

      const { valid, upgradeNeeded } = await verifyPassword(supabase, password, emp.password_hash, emp.password);
      if (!valid) {
        const nextAttempts = (emp.failed_attempts || 0) + 1;
        const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
        const lockUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;

        await supabase
          .from('employees')
          .update({
            failed_attempts: nextAttempts,
            locked_until: lockUntil,
            updated_at: new Date().toISOString(),
          })
          .eq('employee_id', emp.employee_id);

        await logAudit(
          supabase,
          'employee',
          emp.employee_id,
          cleanLower,
          shouldLock ? 'account_locked' : 'login_failed',
          false,
          shouldLock ? 'max_attempts_exceeded' : 'invalid_password'
        );

        return res.status(shouldLock ? 429 : 401).json({
          success: false,
          error: shouldLock
            ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
            : `Incorrect password. ${MAX_FAILED_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
        });
      }

      const updateFields = {
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (upgradeNeeded) {
        updateFields.password_hash = hashPassword(password);
        updateFields.password = null;
      }
      await supabase.from('employees').update(updateFields).eq('employee_id', emp.employee_id);
      await logAudit(supabase, 'employee', emp.employee_id, cleanLower, 'login_success', true);

      const ttl = rememberMe ? 7 * 24 * 3600 : 24 * 3600;
      const { token, expiresAt } = signJwt(
        {
          sub: emp.employee_id,
          role: 'employee',
          employee_id: emp.employee_id,
          email: emp.email || '',
          name: emp.name,
        },
        ttl
      );

      return res.json({
        success: true,
        token,
        expiresAt,
        user: sanitizeEmployee(emp, true),
      });
    }

    // 4. VERIFY SESSION JWT
    if (action === 'verify_session') {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth) {
        return res.status(401).json({ valid: false, error: 'Session expired or invalid.' });
      }
      return res.json({
        valid: true,
        role: auth.claims.role,
        user: auth.user,
      });
    }

    // 5. CHANGE PASSWORD (Authenticated User)
    if (action === 'change_password') {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      const strengthErr = validatePasswordStrength(newPassword);
      if (strengthErr) {
        return res.status(400).json({ success: false, error: strengthErr });
      }

      if (auth.claims.role === 'admin') {
        const { data: admin } = await supabase
          .from('admin_users')
          .select('id, email, password_hash')
          .eq('id', auth.claims.sub)
          .maybeSingle();

        if (!admin) return res.status(404).json({ success: false, error: 'Account not found.' });
        const { valid } = await verifyPassword(supabase, currentPassword, admin.password_hash);
        if (!valid) {
          return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
        }

        await supabase
          .from('admin_users')
          .update({
            password_hash: hashPassword(newPassword),
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', admin.id);

        await logAudit(supabase, 'admin', admin.id, admin.email, 'password_changed', true);
        return res.json({ success: true });
      } else {
        const empId = auth.claims.employee_id || auth.claims.sub;
        const { data: emp } = await supabase
          .from('employees')
          .select('employee_id, password_hash, password')
          .eq('employee_id', empId)
          .maybeSingle();

        if (!emp) return res.status(404).json({ success: false, error: 'Employee account not found.' });
        const { valid } = await verifyPassword(supabase, currentPassword, emp.password_hash, emp.password);
        if (!valid) {
          return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
        }

        await supabase
          .from('employees')
          .update({
            password_hash: hashPassword(newPassword),
            password: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('employee_id', emp.employee_id);

        await logAudit(supabase, 'employee', emp.employee_id, emp.employee_id, 'password_changed', true);
        return res.json({ success: true });
      }
    }

    // 6. REQUEST PASSWORD RESET (WhatsApp OTP)
    if (action === 'request_password_reset') {
      const portal = body.portal === 'admin' ? 'admin' : 'employee';
      const identifier = String(body.identifier || '').trim().toLowerCase();
      if (!identifier) {
        return res.status(400).json({ success: false, error: 'Please enter your Employee ID or Email.' });
      }

      const genericOk = {
        success: true,
        message:
          'If an active account with a registered WhatsApp number matches, a 6-digit verification code has been sent.',
      };

      let actorId = '';
      let phone = '';
      let name = '';

      if (portal === 'admin') {
        const { data: admin } = await findAdminByIdentifier(supabase, identifier);
        if (!admin || !admin.is_active || !admin.phone) {
          return res.json(genericOk);
        }
        actorId = admin.id;
        phone = admin.phone;
        name = admin.name;
      } else {
        const { data: emp } = await findEmployeeByIdentifier(supabase, identifier);
        if (!emp || !emp.is_active || !emp.phone) {
          return res.json(genericOk);
        }
        actorId = emp.employee_id;
        phone = emp.phone;
        name = emp.name;
      }

      const otp = String(crypto.randomInt(100_000, 1_000_000));
      const tokenHash = hashPassword(`${portal}:${actorId}:${otp}`);
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

      await supabase.from('password_reset_tokens').insert({
        actor_type: portal,
        actor_id: actorId,
        identifier,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      await sendWhatsAppResetOtp(phone, name, otp);
      await logAudit(supabase, portal, actorId, identifier, 'password_reset_requested', true);
      return res.json(genericOk);
    }

    // 7. CONFIRM PASSWORD RESET (Verify OTP & Update Password)
    if (action === 'confirm_password_reset') {
      const portal = body.portal === 'admin' ? 'admin' : 'employee';
      const identifier = String(body.identifier || '').trim().toLowerCase();
      const otp = String(body.otp || '').trim();
      const newPassword = String(body.newPassword || '');

      if (!identifier || !otp) {
        return res.status(400).json({ success: false, error: 'Identifier and 6-digit OTP code are required.' });
      }

      const strengthErr = validatePasswordStrength(newPassword);
      if (strengthErr) {
        return res.status(400).json({ success: false, error: strengthErr });
      }

      let actorId = '';
      if (portal === 'admin') {
        const { data: admin } = await findAdminByIdentifier(supabase, identifier);
        if (admin && admin.is_active) actorId = admin.id;
      } else {
        const { data: emp } = await findEmployeeByIdentifier(supabase, identifier);
        if (emp && emp.is_active) actorId = emp.employee_id;
      }

      if (!actorId) {
        return res.status(400).json({ success: false, error: 'Invalid or expired reset code.' });
      }

      const { data: resetRow } = await supabase
        .from('password_reset_tokens')
        .select('*')
        .eq('actor_type', portal)
        .eq('actor_id', actorId)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!resetRow || new Date(resetRow.expires_at).getTime() <= Date.now() || resetRow.attempts >= 5) {
        return res
          .status(400)
          .json({ success: false, error: 'Reset code has expired or exceeded attempts. Request a new one.' });
      }

      const otpValid = verifyPbkdf2(`${portal}:${actorId}:${otp}`, resetRow.token_hash);
      if (!otpValid) {
        await supabase
          .from('password_reset_tokens')
          .update({ attempts: (resetRow.attempts || 0) + 1 })
          .eq('id', resetRow.id);
        return res.status(400).json({ success: false, error: 'Incorrect verification code.' });
      }

      await supabase
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', resetRow.id);

      const newHash = hashPassword(newPassword);
      if (portal === 'admin') {
        await supabase
          .from('admin_users')
          .update({
            password_hash: newHash,
            failed_attempts: 0,
            locked_until: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', actorId);
      } else {
        await supabase
          .from('employees')
          .update({
            password_hash: newHash,
            password: null,
            failed_attempts: 0,
            locked_until: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('employee_id', actorId);
      }

      await logAudit(supabase, portal, actorId, identifier, 'password_reset_completed', true);
      return res.json({ success: true, message: 'Password updated! You can now sign in with your new password.' });
    }

    // 8. GET EMPLOYEES (Authenticated Only)
    if (action === 'get_employees') {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const isAdmin = auth.claims.role === 'admin';
      let query = supabase.from('employees').select('*').order('created_at', { ascending: true });
      if (!isAdmin) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const employees = (data || []).map((row) => sanitizeEmployee(row, isAdmin));
      return res.json({ success: true, employees });
    }

    // 9. UPSERT EMPLOYEE (Admin Only)
    if (action === 'upsert_employee') {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth || auth.claims.role !== 'admin') {
        return res.status(403).json({ error: 'Administrator privileges required.' });
      }

      const emp = body.employee || {};
      const employeeId = String(emp.employee_id || '').trim();
      const name = String(emp.name || '').trim();
      const rawPassword = String(emp.password || '').trim();

      if (!employeeId || !name) {
        return res.status(400).json({ error: 'Employee ID and Name are required.' });
      }

      const { data: existing } = await supabase
        .from('employees')
        .select('employee_id, password_hash, password')
        .eq('employee_id', employeeId)
        .maybeSingle();

      const hasExistingPass = Boolean(existing?.password_hash || existing?.password);
      if (!existing && !rawPassword) {
        return res
          .status(400)
          .json({ error: 'A password of at least 6 characters is required for new employees.' });
      }
      if (rawPassword && rawPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const payload = {
        employee_id: employeeId,
        name,
        email: String(emp.email || '').trim(),
        phone: String(emp.phone || '').trim(),
        department: String(emp.department || 'Sales'),
        role: emp.role === 'admin' ? 'admin' : 'employee',
        is_active: emp.is_active !== undefined ? Boolean(emp.is_active) : true,
        assigned_vehicles: Array.isArray(emp.assigned_vehicles) ? emp.assigned_vehicles : [],
        assigned_subtypes: Array.isArray(emp.assigned_subtypes) ? emp.assigned_subtypes : [],
        updated_at: new Date().toISOString(),
      };

      if (rawPassword) {
        payload.password_hash = hashPassword(rawPassword);
        payload.password = null;
        payload.failed_attempts = 0;
        payload.locked_until = null;
      } else if (!hasExistingPass) {
        return res.status(400).json({ error: 'Please set a password for this employee account.' });
      }

      let { data, error } = await supabase
        .from('employees')
        .upsert(payload, { onConflict: 'employee_id' })
        .select('*')
        .single();

      if (error && (error.message?.includes('assigned_vehicles') || error.message?.includes('assigned_subtypes'))) {
        const { assigned_vehicles: _av, assigned_subtypes: _as, ...rest } = payload;
        const retry = await supabase
          .from('employees')
          .upsert(rest, { onConflict: 'employee_id' })
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error || !data) {
        return res.status(500).json({ error: error?.message || 'Failed to save employee.' });
      }

      return res.json({
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
    if (action === 'deactivate_employee') {
      const auth = await authenticateRequest(req, body, supabase);
      if (!auth || auth.claims.role !== 'admin') {
        return res.status(403).json({ error: 'Administrator privileges required.' });
      }

      const employeeId = String(body.employeeId || '').trim();
      if (!employeeId) {
        return res.status(400).json({ error: 'Missing employeeId.' });
      }

      const { error } = await supabase
        .from('employees')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('employee_id', employeeId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.json({ success: true });
    }

    return res.status(400).json({ error: `Unknown auth action: ${action}` });
  } catch (err) {
    logger.error('Local Auth route error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

module.exports = { handleAuthRequest };
