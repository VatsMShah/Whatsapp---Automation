-- =========================================================================
-- TRAKET CRM — CORE OPERATIONAL TABLES ROW-LEVEL SECURITY (RLS) LOCKDOWN
-- Run this script once in the Supabase SQL Editor (Project: njmzdeddmangggeukjce)
-- or via the Supabase Management API.
--
-- What this migration does:
-- 1. Enables Row Level Security (RLS) on all core operational tables:
--    `users_master`, `book_vehicle`, `provide_vehicle`, `lead_status`, `support`,
--    and `book_vehicle_backup`.
-- 2. Drops insecure legacy policies (e.g. "Allow all operations for anon").
-- 3. Explicitly DENIES direct client (anon, authenticated) access from browsers.
-- 4. Revokes all table privileges from `anon` and `authenticated`.
-- 5. Grants full table permissions and permissive policies to `service_role`
--    so the backend server proxy (`/api/crm/...`) and WhatsApp webhook handlers
--    can safely read and write data with role-based authorization.
-- =========================================================================

SET search_path TO public, extensions;

-- -------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY ON CORE TABLES
-- -------------------------------------------------------------------------
ALTER TABLE public.users_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provide_vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_vehicle_backup ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 2. REMOVE INSECURE LEGACY POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.book_vehicle;
DROP POLICY IF EXISTS "Allow anon access to lead_status" ON public.lead_status;

-- -------------------------------------------------------------------------
-- 3. EXPLICITLY DENY DIRECT CLIENT ACCESS (ANON, AUTHENTICATED)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Deny direct client access to book_vehicle" ON public.book_vehicle;
CREATE POLICY "Deny direct client access to book_vehicle"
ON public.book_vehicle
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to lead_status" ON public.lead_status;
CREATE POLICY "Deny direct client access to lead_status"
ON public.lead_status
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to users_master" ON public.users_master;
CREATE POLICY "Deny direct client access to users_master"
ON public.users_master
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to provide_vehicle" ON public.provide_vehicle;
CREATE POLICY "Deny direct client access to provide_vehicle"
ON public.provide_vehicle
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to support" ON public.support;
CREATE POLICY "Deny direct client access to support"
ON public.support
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct client access to book_vehicle_backup" ON public.book_vehicle_backup;
CREATE POLICY "Deny direct client access to book_vehicle_backup"
ON public.book_vehicle_backup
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- -------------------------------------------------------------------------
-- 4. REVOKE TABLE GRANTS FROM PUBLIC / ANON / AUTHENTICATED
-- -------------------------------------------------------------------------
REVOKE ALL ON TABLE public.book_vehicle FROM anon, authenticated;
REVOKE ALL ON TABLE public.lead_status FROM anon, authenticated;
REVOKE ALL ON TABLE public.users_master FROM anon, authenticated;
REVOKE ALL ON TABLE public.provide_vehicle FROM anon, authenticated;
REVOKE ALL ON TABLE public.support FROM anon, authenticated;
REVOKE ALL ON TABLE public.book_vehicle_backup FROM anon, authenticated;

-- -------------------------------------------------------------------------
-- 5. GRANT AND PERMIT FULL ACCESS TO SERVICE_ROLE (BACKEND SERVER PROXY)
-- -------------------------------------------------------------------------
GRANT ALL ON TABLE public.book_vehicle TO service_role;
GRANT ALL ON TABLE public.lead_status TO service_role;
GRANT ALL ON TABLE public.users_master TO service_role;
GRANT ALL ON TABLE public.provide_vehicle TO service_role;
GRANT ALL ON TABLE public.support TO service_role;
GRANT ALL ON TABLE public.book_vehicle_backup TO service_role;

DROP POLICY IF EXISTS "Allow service_role full access to book_vehicle" ON public.book_vehicle;
CREATE POLICY "Allow service_role full access to book_vehicle"
ON public.book_vehicle
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to lead_status" ON public.lead_status;
CREATE POLICY "Allow service_role full access to lead_status"
ON public.lead_status
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to users_master" ON public.users_master;
CREATE POLICY "Allow service_role full access to users_master"
ON public.users_master
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to provide_vehicle" ON public.provide_vehicle;
CREATE POLICY "Allow service_role full access to provide_vehicle"
ON public.provide_vehicle
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to support" ON public.support;
CREATE POLICY "Allow service_role full access to support"
ON public.support
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to book_vehicle_backup" ON public.book_vehicle_backup;
CREATE POLICY "Allow service_role full access to book_vehicle_backup"
ON public.book_vehicle_backup
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
