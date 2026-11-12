-- =========================================================================
-- TRAKET CRM — INDUSTRY-STANDARD JWT & HASHED PASSWORD SECURITY MIGRATION
-- Run this script once in the Supabase SQL Editor (Project: njmzdeddmangggeukjce)
--
-- What this migration does:
-- 1. Enables pgcrypto for cryptographic bcrypt password hashing.
-- 2. Creates `admin_users` table (replaces hardcoded frontend admin passwords).
-- 3. Upgrades `employees` with `password_hash`, lockout fields, and migrates
--    any existing plaintext passwords to bcrypt hashes, then wipes plaintext.
-- 4. Adds a trigger so plaintext passwords can NEVER be stored in `employees`.
-- 5. Creates `auth_audit_logs` & `password_reset_tokens` (WhatsApp OTP resets).
-- 6. Locks down Row Level Security (RLS) so anonymous browser requests CANNOT
--    read/modify `employees`, `admin_users`, `auth_audit_logs`, or tokens.
-- 7. Creates `SECURITY DEFINER` bcrypt helper RPCs for the `auth` Edge Function.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path TO public, extensions;

-- -------------------------------------------------------------------------
-- 1. ADMIN USERS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Traket Administrator',
    phone TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(LOWER(username));

-- Bootstrap initial admin ONLY if no admin exists yet.
-- IMPORTANT: Sign in with admin@traket.in / Traket@Admin2026! and change it immediately when prompted.
INSERT INTO public.admin_users (username, email, name, password_hash, must_change_password)
SELECT
    'admin',
    'admin@traket.in',
    'Traket Dispatch Admin',
    crypt('Traket@Admin2026!', gen_salt('bf', 10)),
    true
WHERE NOT EXISTS (SELECT 1 FROM public.admin_users);

-- -------------------------------------------------------------------------
-- 2. UPGRADE EMPLOYEES TABLE (HASHED PASSWORDS + LOCKOUTS)
-- -------------------------------------------------------------------------
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Migrate any legacy plaintext passwords into bcrypt hashes & clear plaintext column
UPDATE public.employees
SET
    password_hash = crypt(password, gen_salt('bf', 10)),
    password = NULL
WHERE password IS NOT NULL
  AND btrim(password) <> ''
  AND (password_hash IS NULL OR btrim(password_hash) = '');

UPDATE public.employees
SET password = NULL
WHERE password IS NOT NULL;

-- Trigger: If any legacy code writes a plaintext `password` into `employees`,
-- automatically hash it into `password_hash` and clear `password` before saving.
CREATE OR REPLACE FUNCTION public.hash_employee_password_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password IS NOT NULL AND btrim(NEW.password) <> '' THEN
        NEW.password_hash := crypt(NEW.password, gen_salt('bf', 10));
        NEW.password := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

DROP TRIGGER IF EXISTS trg_hash_employee_password ON public.employees;
CREATE TRIGGER trg_hash_employee_password
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.hash_employee_password_trigger();

-- -------------------------------------------------------------------------
-- 3. AUTH AUDIT LOGS & PASSWORD RESET TOKENS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL, -- 'admin' | 'employee'
    actor_id TEXT,
    identifier TEXT,
    event_type TEXT NOT NULL, -- 'login_success' | 'login_failed' | 'account_locked' | 'password_changed' | 'password_reset_requested' | 'password_reset_completed'
    success BOOLEAN NOT NULL DEFAULT false,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON public.auth_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    identifier TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_lookup ON public.password_reset_tokens(actor_type, actor_id, created_at DESC);

-- -------------------------------------------------------------------------
-- 4. LOCK DOWN ROW LEVEL SECURITY (RLS) ON AUTH TABLES
--    Removes anonymous browser access to credentials & employee tables!
-- -------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Remove insecure public policy on employees
DROP POLICY IF EXISTS "Allow anon access to employees" ON public.employees;
DROP POLICY IF EXISTS "Deny direct client access to employees" ON public.employees;
CREATE POLICY "Deny direct client access to employees"
ON public.employees
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to admin_users" ON public.admin_users;
CREATE POLICY "Deny direct client access to admin_users"
ON public.admin_users
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to auth_audit_logs" ON public.auth_audit_logs;
CREATE POLICY "Deny direct client access to auth_audit_logs"
ON public.auth_audit_logs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to password_reset_tokens" ON public.password_reset_tokens;
CREATE POLICY "Deny direct client access to password_reset_tokens"
ON public.password_reset_tokens
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Revoke table grants from anon/authenticated; keep service_role full access
REVOKE ALL ON TABLE public.employees FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_users FROM anon, authenticated;
REVOKE ALL ON TABLE public.auth_audit_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.password_reset_tokens FROM anon, authenticated;

GRANT ALL ON TABLE public.employees TO service_role;
GRANT ALL ON TABLE public.admin_users TO service_role;
GRANT ALL ON TABLE public.auth_audit_logs TO service_role;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;

-- -------------------------------------------------------------------------
-- 5. BCRYPT HELPER RPCs (Callable ONLY by service_role inside Edge Function)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_verify_bcrypt(p_plain TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF p_plain IS NULL OR p_hash IS NULL OR btrim(p_hash) = '' THEN
        RETURN FALSE;
    END IF;
    RETURN crypt(p_plain, p_hash) = p_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_hash_bcrypt(p_plain TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF p_plain IS NULL OR btrim(p_plain) = '' THEN
        RAISE EXCEPTION 'Password cannot be empty';
    END IF;
    RETURN crypt(p_plain, gen_salt('bf', 10));
END;
$$;

REVOKE ALL ON FUNCTION public.auth_verify_bcrypt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auth_hash_bcrypt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_verify_bcrypt(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_hash_bcrypt(TEXT) TO service_role;
