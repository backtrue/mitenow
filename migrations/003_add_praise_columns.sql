-- Migration: Add praise columns to deployments table
-- For the "誇誇人" (Praise Generator) feature

ALTER TABLE deployments ADD COLUMN praise_text TEXT;
ALTER TABLE deployments ADD COLUMN praise_character TEXT;
