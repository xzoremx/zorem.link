-- Migration 003: Stories views table
-- Tracks which stories have been viewed by which viewers (optional feature)

CREATE TABLE IF NOT EXISTS views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for views
CREATE INDEX idx_views_story_id ON views(story_id);
CREATE INDEX idx_views_viewer_hash ON views(viewer_hash);
CREATE INDEX idx_views_story_viewer ON views(story_id, viewer_hash);

-- Unique constraint: one view per story per viewer
CREATE UNIQUE INDEX idx_views_story_viewer_unique ON views(story_id, viewer_hash);
