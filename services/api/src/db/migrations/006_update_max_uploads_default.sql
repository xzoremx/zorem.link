-- Migration 006: Update max_uploads_per_viewer default to 1
-- Changes the default value from 3 to 1

-- Update existing rooms with default 3 to 1 (if they still have the old default)
UPDATE rooms SET max_uploads_per_viewer = 1 WHERE max_uploads_per_viewer = 3;

-- Change the default value for future inserts
ALTER TABLE rooms ALTER COLUMN max_uploads_per_viewer SET DEFAULT 1;
