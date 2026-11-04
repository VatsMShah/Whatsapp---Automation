-- =========================================================================
-- CREATE SEPARATE TABLE: employees
-- Stores team members created by Admin with auto-generated sequential IDs
-- Keeps all main data tables (book_vehicle, etc.) completely untouched.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT DEFAULT 'Sales',
    password TEXT,
    role TEXT DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    assigned_vehicles TEXT[] DEFAULT '{}',
    assigned_subtypes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups & filtering
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated dashboard access for read & write
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'employees' 
          AND policyname = 'Allow anon access to employees'
    ) THEN
        CREATE POLICY "Allow anon access to employees"
        ON public.employees
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;

-- Grant permissions to Supabase API roles
GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;

-- Ensure lead_status table has employee assignment fields if not already present
ALTER TABLE public.lead_status 
ADD COLUMN IF NOT EXISTS assigned_to TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transferred_from TEXT,
ADD COLUMN IF NOT EXISTS transfer_note TEXT;

CREATE INDEX IF NOT EXISTS idx_lead_status_assigned_to ON public.lead_status(assigned_to);

-- Function and trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_employees_updated_at ON public.employees;
CREATE TRIGGER set_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
