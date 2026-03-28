-- D1 Schema Migration 0004: MFA support
-- Adds MFA (TOTP) fields to profiles for two-factor authentication

-- Add MFA columns to profiles
ALTER TABLE profiles ADD COLUMN mfa_enabled INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN mfa_secret TEXT;
ALTER TABLE profiles ADD COLUMN mfa_backup_codes TEXT;  -- JSON array of backup codes
