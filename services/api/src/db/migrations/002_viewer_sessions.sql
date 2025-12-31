-- Migration 002: Viewer sessions table
-- Stores temporary viewer sessions (no permanent accounts)

CREATE TABLE IF NOT EXISTS viewer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    viewer_hash VARCHAR(64) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for viewer_sessions
CREATE INDEX idx_viewer_sessions_room_id ON viewer_sessions(room_id);
CREATE INDEX idx_viewer_sessions_hash ON viewer_sessions(viewer_hash);
CREATE INDEX idx_viewer_sessions_room_hash ON viewer_sessions(room_id, viewer_hash);

-- Unique constraint: one viewer_hash per room (prevents duplicate nicknames in same room)
CREATE UNIQUE INDEX idx_viewer_sessions_room_hash_unique ON viewer_sessions(room_id, viewer_hash);
