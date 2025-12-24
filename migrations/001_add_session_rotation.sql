-- Migration: Add session rotation tracking fields
-- Date: 2024-12-24
-- Description: Add last_rotated_at and rotation_count to sessions table

-- Add new columns for session rotation
ALTER TABLE sessions ADD COLUMN last_rotated_at INTEGER;
ALTER TABLE sessions ADD COLUMN rotation_count INTEGER DEFAULT 0;

-- Update existing sessions with initial values
UPDATE sessions 
SET last_rotated_at = created_at, 
    rotation_count = 0 
WHERE last_rotated_at IS NULL;
