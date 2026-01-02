-- Migration 006: Room stories version (for ETag/SSE invalidation)
-- Adds a monotonically increasing version that changes when stories/likes change.

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS stories_version BIGINT NOT NULL DEFAULT 0;

