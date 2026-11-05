-- =========================================================================
-- ADD DECISION-MAKER / BUSINESS APPROVER COLUMNS TO book_vehicle
-- Separates Lead Submitter (Operational) from Decision Maker (Commercial)
-- =========================================================================

ALTER TABLE public.book_vehicle
  ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS approver_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS approver_phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS approver_role TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT DEFAULT '';

