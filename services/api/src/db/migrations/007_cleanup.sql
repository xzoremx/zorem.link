-- Cleanup system: locks table and media tracking

-- Table to prevent concurrent cleanup executions
CREATE TABLE IF NOT EXISTS cleanup_locks (
    id TEXT PRIMARY KEY,
    locked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    locked_by TEXT NOT NULL
);

-- Track when media was deleted from storage (for soft-delete phase)
ALTER TABLE stories ADD COLUMN IF NOT EXISTS media_deleted_at TIMESTAMP WITH TIME ZONE;

-- Index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_stories_media_deleted ON stories(media_deleted_at) WHERE media_deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_cleanup ON rooms(expires_at) WHERE is_active = true;
