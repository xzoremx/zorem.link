-- Migration 005: Upload limits per viewer and story likes
-- Adds max uploads limit and tracks story creators

-- Add max_uploads_per_viewer to rooms (NULL means unlimited)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_uploads_per_viewer INTEGER DEFAULT 3;

-- Add creator_viewer_hash to stories to track who uploaded each story
ALTER TABLE stories ADD COLUMN IF NOT EXISTS creator_viewer_hash VARCHAR(64);

-- Create story_likes table
CREATE TABLE IF NOT EXISTS story_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for story_likes
CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_viewer_hash ON story_likes(viewer_hash);

-- Unique constraint: one like per story per viewer
CREATE UNIQUE INDEX IF NOT EXISTS idx_story_likes_unique ON story_likes(story_id, viewer_hash);

-- Index for counting uploads per viewer in a room
CREATE INDEX IF NOT EXISTS idx_stories_creator_viewer ON stories(room_id, creator_viewer_hash) WHERE creator_viewer_hash IS NOT NULL;
