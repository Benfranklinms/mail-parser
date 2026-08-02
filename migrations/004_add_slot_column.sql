-- Migration 004: Add slot column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS slot text DEFAULT NULL;
