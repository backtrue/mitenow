-- Migration: Add session rotation columns
-- Date: 2024-12-24
-- Description: Adds last_rotated_at and rotation_count columns to sessions table
--              for session rotation security feature

-- Add last_rotated_at column
ALTER TABLE sessions ADD COLUMN last_rotated_at INTEGER;

-- Add rotation_count column
ALTER TABLE sessions ADD COLUMN rotation_count INTEGER DEFAULT 0;

-- Update existing sessions with default values
UPDATE sessions SET 
  last_rotated_at = created_at,
  rotation_count = 0
WHERE last_rotated_at IS NULL;
