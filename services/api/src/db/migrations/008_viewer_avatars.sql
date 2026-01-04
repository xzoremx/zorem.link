-- Viewer avatars and emoji tracking

-- Add avatar column to viewer_sessions
ALTER TABLE viewer_sessions ADD COLUMN IF NOT EXISTS avatar VARCHAR(10);

-- Table for tracking emoji popularity (trending)
CREATE TABLE IF NOT EXISTS emoji_stats (
    emoji VARCHAR(10) PRIMARY KEY,
    use_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient trending query
CREATE INDEX IF NOT EXISTS idx_emoji_stats_trending
ON emoji_stats(use_count DESC, last_used_at DESC);

-- Update existing viewer_sessions with default avatar
UPDATE viewer_sessions SET avatar = '😀' WHERE avatar IS NULL;
